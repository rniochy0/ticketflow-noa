"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser, type SessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { detectMime } from "@/lib/attachments/sniff";
import {
  ATTACHMENT_BUCKET,
  EXTENSION_BY_MIME,
  MAX_ATTACHMENTS_PER_TICKET,
  MAX_FILE_BYTES,
  formatBytes,
  isAllowedMime,
} from "@/lib/attachments/constants";

// Fluxo em 3 passos (o ficheiro NUNCA passa pelo servidor da app, porque a
// Vercel corta pedidos acima de 4,5 MB):
//   1. createUploadTarget  -> autoriza e devolve um URL de upload assinado
//   2. o browser envia o ficheiro directamente para o Storage
//   3. finalizeAttachment  -> o servidor lê o ficheiro, valida o conteúdo real
//                             e só então o regista na tabela

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type UploadTargetResult =
  | { ok: true; path: string; token: string }
  | { ok: false; error: string };

export type FinalizeResult = { ok: true; id: string } | { ok: false; error: string };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PATH_RE = new RegExp(`^${UUID}/${UUID}\\.(jpg|png|webp|pdf)$`);

// Mesmas regras nos dois passos: o 2º não confia no que o 1º decidiu.
async function checkUploadAllowed(
  supabase: SupabaseServerClient,
  user: SessionUser,
  ticketId: string,
  messageId: string | undefined
): Promise<string | null> {
  const { data: ticket } = await supabase
    .from("tickets")
    .select("status, requester_id")
    .eq("id", ticketId)
    .single();

  if (!ticket) return "Pedido não encontrado.";
  if (ticket.status === "CLOSED") {
    return "O pedido está fechado: não é possível anexar ficheiros.";
  }
  if (!can(user.role, "ticket:handle") && ticket.requester_id !== user.id) {
    return "Não tens permissão para anexar ficheiros neste pedido.";
  }

  const { count } = await supabase
    .from("ticket_attachments")
    .select("id", { count: "exact", head: true })
    .eq("ticket_id", ticketId);
  if ((count ?? 0) >= MAX_ATTACHMENTS_PER_TICKET) {
    return `Este pedido já atingiu o limite de ${MAX_ATTACHMENTS_PER_TICKET} anexos.`;
  }

  if (messageId) {
    // Só se anexa a mensagens do próprio, no mesmo ticket
    const { data: message } = await supabase
      .from("ticket_messages")
      .select("id")
      .eq("id", messageId)
      .eq("ticket_id", ticketId)
      .eq("author_id", user.id)
      .single();
    if (!message) return "Mensagem inválida para este anexo.";
  }

  return null;
}

const targetSchema = z.object({
  ticketId: z.uuid(),
  messageId: z.uuid().optional(),
  size: z.number().int().positive().max(MAX_FILE_BYTES),
  mime: z.string(),
});

export async function createUploadTarget(input: unknown): Promise<UploadTargetResult> {
  const user = await requireUser();

  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Pedido inválido ou ficheiro acima de ${formatBytes(MAX_FILE_BYTES)}.`,
    };
  }
  const { ticketId, messageId, mime } = parsed.data;

  if (!isAllowedMime(mime)) {
    return { ok: false, error: "Tipo de ficheiro não suportado (só JPG, PNG, WebP ou PDF)." };
  }

  const supabase = await createClient();
  const denied = await checkUploadAllowed(supabase, user, ticketId, messageId);
  if (denied) return { ok: false, error: denied };

  // O caminho é gerado aqui: o nome enviado pelo cliente nunca entra nele
  // (impede path traversal e colisões).
  const path = `${ticketId}/${crypto.randomUUID()}.${EXTENSION_BY_MIME[mime]}`;

  // Exige permissão de INSERT em storage.objects (policy "ticket_attachments_upload")
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) return { ok: false, error: "Não foi possível preparar o envio." };
  return { ok: true, path: data.path, token: data.token };
}

const finalizeSchema = z.object({
  ticketId: z.uuid(),
  messageId: z.uuid().optional(),
  path: z.string().regex(PATH_RE),
  fileName: z.string().min(1).max(255),
});

// Remove o nome do ficheiro de caracteres de controlo e de direcção de texto
// (truque "fatura\u202Egpj.exe") e força a extensão a corresponder ao tipo real.
function cleanDisplayName(original: string, ext: string): string {
  const base = original.split(/[\\/]/).pop() ?? "";
  const withoutExt = base.replace(/\.[^.]*$/, "");
  const cleaned = withoutExt
    .replace(/[\p{Cc}\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu, "")
    .trim()
    .slice(0, 100);
  return `${cleaned || "anexo"}.${ext}`;
}

export async function finalizeAttachment(input: unknown): Promise<FinalizeResult> {
  const user = await requireUser();

  const parsed = finalizeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pedido inválido." };
  const { ticketId, messageId, path, fileName } = parsed.data;

  // O ficheiro tem de estar na pasta do ticket indicado
  if (!path.startsWith(`${ticketId}/`)) return { ok: false, error: "Pedido inválido." };

  const supabase = await createClient();
  const discard = async () => {
    // Só funciona em ficheiros sem registo (policy "…_delete_unregistered")
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([path]);
  };

  const denied = await checkUploadAllowed(supabase, user, ticketId, messageId);
  if (denied) {
    await discard();
    return { ok: false, error: denied };
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .download(path);
  if (downloadError || !blob) {
    return { ok: false, error: "O ficheiro não chegou ao armazenamento. Tenta de novo." };
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_FILE_BYTES) {
    await discard();
    return { ok: false, error: `O ficheiro tem de ter até ${formatBytes(MAX_FILE_BYTES)}.` };
  }

  // O tipo REAL pelo conteúdo, e tem de bater certo com o declarado no passo 1
  const detected = detectMime(bytes);
  const ext = path.split(".").pop();
  if (!detected || EXTENSION_BY_MIME[detected] !== ext) {
    await discard();
    return {
      ok: false,
      error: "O conteúdo do ficheiro não corresponde a um JPG, PNG, WebP ou PDF válido.",
    };
  }

  const { data: row, error: insertError } = await supabase
    .from("ticket_attachments")
    .insert({
      ticket_id: ticketId,
      message_id: messageId ?? null,
      uploader_id: user.id,
      storage_path: path,
      file_name: cleanDisplayName(fileName, EXTENSION_BY_MIME[detected]),
      mime_type: detected,
      size_bytes: bytes.length,
    })
    .select("id")
    .single();

  if (insertError || !row) {
    await discard();
    return { ok: false, error: "Não foi possível registar o anexo." };
  }

  return { ok: true, id: row.id };
}