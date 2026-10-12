import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ATTACHMENT_BUCKET } from "@/lib/attachments/constants";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Os anexos não têm URL público. A página usa /api/attachments/<id>; esta rota
// verifica a sessão E o RLS no momento do pedido e redirecciona para um URL
// assinado de 60 segundos. Assim nenhum link guardado ou partilhado dura.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return new NextResponse("Não encontrado", { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Sem sessão", { status: 401 });

  // O RLS decide se este utilizador vê o anexo (= se vê o ticket).
  // "Não existe" e "não é teu" dão a mesma resposta, de propósito.
  const { data: attachment } = await supabase
    .from("ticket_attachments")
    .select("storage_path, mime_type, file_name, purged_at")
    .eq("id", id)
    .single();

  if (!attachment) return new NextResponse("Não encontrado", { status: 404 });
  if (attachment.purged_at) {
    return new NextResponse("Anexo removido após o período de retenção", { status: 410 });
  }

  // PDFs descarregam sempre (nunca abrem dentro do browser); imagens abrem.
  const forceDownload = attachment.mime_type === "application/pdf";

  const { data: signed, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(
      attachment.storage_path,
      60,
      forceDownload ? { download: attachment.file_name } : undefined
    );

  if (error || !signed?.signedUrl) return new NextResponse("Não encontrado", { status: 404 });

  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "private, no-store" },
  });
}