import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildGuidePdf, type GuideLine } from "@/lib/supply/guide-pdf";
import { loadLogoPng } from "@/lib/brand/logo";

// A guia é gerada a pedido a partir dos dados guardados (não há ficheiro no
// disco). A autorização é o próprio RLS: só vê a guia quem vê o pedido
// (solicitante ou equipa). Quem não tem acesso recebe 404, sem pistas.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: guide } = await supabase
    .from("delivery_guides")
    .select(
      "number, issued_at, issued_by_name, received_by_name, requester_name, store_name, lines, supply_requests(number, notes)"
    )
    .eq("id", id)
    .single();
  if (!guide) return new Response("Not found", { status: 404 });

  const req = guide.supply_requests as unknown as { number: string; notes: string | null } | null;

  const pdf = await buildGuidePdf({
    number: guide.number,
    requestNumber: req?.number ?? "",
    issuedAt: guide.issued_at,
    issuedByName: guide.issued_by_name,
    receivedByName: guide.received_by_name,
    requesterName: guide.requester_name,
    storeName: guide.store_name,
    notes: req?.notes ?? null,
    lines: guide.lines as GuideLine[],
    logoPng: await loadLogoPng(),
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${guide.number}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
