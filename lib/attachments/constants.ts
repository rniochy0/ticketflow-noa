// Partilhado entre browser e servidor (por isso sem "server-only").

export const ATTACHMENT_BUCKET = "ticket-attachments";

// Mesmo limite no bucket (Storage), na tabela (CHECK) e aqui. É uma escolha
// nossa para controlar o espaço (o Supabase aceitaria mais). As fotos são
// reduzidas no browser e quase nunca chegam aqui; aplica-se sobretudo a PDFs.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
// Fotos de telemóvel chegam a 10+ MB: aceitam-se até 40 MB à entrada
// porque as imagens são reduzidas no browser antes de seguirem.
export const MAX_RAW_IMAGE_BYTES = 40 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 5;
export const MAX_ATTACHMENTS_PER_TICKET = 30;

// Só imagens raster e PDF. SVG, HTML e executáveis ficam de fora de propósito
// (SVG pode conter scripts).
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;
export type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];

export const EXTENSION_BY_MIME: Record<AllowedMime, "jpg" | "png" | "webp" | "pdf"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export const ACCEPT_ATTR = ALLOWED_MIME_TYPES.join(",");

export function isAllowedMime(value: string): value is AllowedMime {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Validação "de cortesia" no browser, para dar feedback imediato.
// A validação a sério é feita no servidor (magic bytes) e no Storage/BD (limites).
export function validateSelectedFile(file: File): string | null {
  if (!isAllowedMime(file.type)) {
    return `"${file.name}": tipo não suportado (só JPG, PNG, WebP ou PDF).`;
  }
  if (file.size === 0) return `"${file.name}" está vazio.`;
  const limit = file.type === "application/pdf" ? MAX_FILE_BYTES : MAX_RAW_IMAGE_BYTES;
  if (file.size > limit) {
    return `"${file.name}" excede ${formatBytes(limit)}.`;
  }
  return null;
}