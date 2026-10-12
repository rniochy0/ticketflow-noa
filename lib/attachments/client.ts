import { createClient } from "@/lib/supabase/client";
import { createUploadTarget, finalizeAttachment } from "@/app/tickets/attachments";
import { ATTACHMENT_BUCKET, MAX_FILE_BYTES, formatBytes } from "./constants";

// Tentativas por ordem: a primeira costuma bastar (uma foto de telemóvel
// de 8 MB fica com 0,3 a 1,5 MB). As seguintes só entram se ainda for grande.
const ATTEMPTS = [
  { maxSide: 2000, quality: 0.85 },
  { maxSide: 1600, quality: 0.7 },
  { maxSide: 1200, quality: 0.6 },
];

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    // "from-image" respeita a orientação EXIF (fotos de telemóvel na vertical)
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(file);
  }
}

async function renderJpeg(
  bitmap: ImageBitmap,
  maxSide: number,
  quality: number
): Promise<Blob | null> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff"; // JPEG não tem transparência (PNG com fundo transparente)
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

// Reduz e re-codifica imagens antes de as enviar. Efeitos:
//  - poupa espaço de armazenamento e dados móveis;
//  - remove os metadados EXIF (incluindo a localização GPS das fotos).
// Se falhar por qualquer razão, devolve o original (o servidor valida na mesma).
export async function prepareForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await loadBitmap(file);
    try {
      for (const { maxSide, quality } of ATTEMPTS) {
        const blob = await renderJpeg(bitmap, maxSide, quality);
        if (blob && blob.size <= MAX_FILE_BYTES) {
          const name = file.name.replace(/\.[^.]*$/, "") + ".jpg";
          return new File([blob], name, { type: "image/jpeg" });
        }
      }
    } finally {
      bitmap.close();
    }
  } catch {
    // cai para o original
  }
  return file;
}

export async function uploadFiles({
  ticketId,
  messageId,
  files,
  onProgress,
}: {
  ticketId: string;
  messageId?: string;
  files: File[];
  onProgress?: (current: number, total: number) => void;
}): Promise<{ failed: number; failedFiles: File[]; firstError?: string }> {
  const supabase = createClient();
  const failedFiles: File[] = [];
  let firstError: string | undefined;
  // Guardamos o ficheiro ORIGINAL que falhou, para a UI o poder reenviar
  const fail = (original: File, message: string) => {
    failedFiles.push(original);
    firstError ??= message;
  };

  // Um de cada vez: poupa memória e a ligação (telemóvel) e dá progresso claro
  for (let i = 0; i < files.length; i += 1) {
    onProgress?.(i + 1, files.length);
    const file = await prepareForUpload(files[i]);

    if (file.size > MAX_FILE_BYTES) {
      fail(files[i], `"${files[i].name}" excede ${formatBytes(MAX_FILE_BYTES)}.`);
      continue;
    }

    try {
      // 1) o servidor autoriza e emite o URL de upload
      const target = await createUploadTarget({
        ticketId,
        messageId,
        size: file.size,
        mime: file.type,
      });
      if (!target.ok) {
        fail(files[i], target.error);
        continue;
      }

      // 2) o ficheiro vai directamente para o Storage
      const { error } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .uploadToSignedUrl(target.path, target.token, file, { contentType: file.type });
      if (error) {
        fail(files[i], "Falha no envio do ficheiro. Verifica a ligação e tenta de novo.");
        continue;
      }

      // 3) o servidor valida o conteúdo real e regista o anexo
      const done = await finalizeAttachment({
        ticketId,
        messageId,
        path: target.path,
        fileName: file.name,
      });
      if (!done.ok) fail(files[i], done.error);
    } catch {
      fail(files[i], "Falha de ligação ao enviar o anexo.");
    }
  }

  return { failed: failedFiles.length, failedFiles, firstError };
}