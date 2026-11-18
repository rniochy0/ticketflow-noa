"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { supplyErrorMessage } from "@/lib/supply/errors";
import { buildGuidePdf, type GuideLine } from "@/lib/supply/guide-pdf";
import { loadLogoPng } from "@/lib/brand/logo";
import {
  parseSupplyLines,
  supplyNotesSchema,
  decideSchema,
  deliverSchema,
  requestIdSchema,
} from "@/lib/validation/supply";
import {
  recipientsExcept,
  notifySupplyRequested,
  notifySupplyDecision,
  notifySupplyReadyToDeliver,
  notifySupplyDelivered,
  notifyLowStock,
} from "@/lib/email/notifications";

type Supa = Awaited<ReturnType<typeof createClient>>;
export type SupplyActionState = { ok?: boolean; error?: string };

// Destinatários por função SQL (security definer): o RLS de profiles não
// deixa colaboradores ler os emails da equipa directamente.
async function emailsFor(
  supabase: Supa,
  requestId: string,
  audience: "MANAGERS" | "AGENTS" | "REQUESTER"
): Promise<string[]> {
  const { data } = await supabase.rpc("supply_notify_emails", {
    p_id: requestId,
    p_audience: audience,
  });
  return ((data ?? []) as { email: string }[]).map((r) => r.email);
}

async function requestNumber(supabase: Supa, id: string): Promise<string | null> {
  const { data } = await supabase.from("supply_requests").select("number").eq("id", id).single();
  return data?.number ?? null;
}

function revalidateSupply(id?: string) {
  revalidatePath("/materiais");
  revalidatePath("/materiais/gestao");
  revalidatePath("/materiais/stock");
  if (id) revalidatePath(`/materiais/${id}`);
}

// ---------- colaborador: criar / cancelar ----------
export async function createSupplyRequest(
  _prev: SupplyActionState,
  formData: FormData
): Promise<SupplyActionState> {
  const user = await requirePermission("ticket:create");

  const parsed = parseSupplyLines(formData);
  if ("error" in parsed) return { error: parsed.error };

  const notes = supplyNotesSchema.safeParse(String(formData.get("notes") ?? ""));
  if (!notes.success) return { error: notes.error.issues[0]?.message };

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_supply_request", {
    p_notes: notes.data || null,
    p_lines: parsed.lines.map((l) => ({ item_id: l.itemId, qty: l.qty })),
  });
  if (error || !id) return { error: supplyErrorMessage(error) };

  const requestId = id as string;
  const number = await requestNumber(supabase, requestId);
  if (number) {
    const managers = recipientsExcept(await emailsFor(supabase, requestId, "MANAGERS"), user.email);
    await notifySupplyRequested({ id: requestId, number }, managers, user.fullName || user.email);
  }

  revalidateSupply();
  redirect(`/materiais/${requestId}`);
}

export async function cancelSupplyRequest(requestId: string): Promise<SupplyActionState> {
  await requirePermission("ticket:create");
  const parsed = requestIdSchema.safeParse({ requestId });
  if (!parsed.success) return { error: "Pedido inválido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_supply_request", { p_id: parsed.data.requestId });
  if (error) return { error: supplyErrorMessage(error) };

  revalidateSupply(parsed.data.requestId);
  return { ok: true };
}

// ---------- gestor: aprovar / rejeitar ----------
export async function decideSupplyRequest(
  requestId: string,
  approve: boolean,
  note: string
): Promise<SupplyActionState> {
  const user = await requirePermission("admin:manage");
  const parsed = decideSchema.safeParse({ requestId, approve, note });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_supply_request", {
    p_id: parsed.data.requestId,
    p_approve: parsed.data.approve,
    p_note: parsed.data.note || null,
  });
  if (error) return { error: supplyErrorMessage(error) };

  const number = await requestNumber(supabase, parsed.data.requestId);
  if (number) {
    const ref = { id: parsed.data.requestId, number };
    const requester = await emailsFor(supabase, ref.id, "REQUESTER");
    if (requester[0]) await notifySupplyDecision(ref, requester[0], parsed.data.approve);

    if (parsed.data.approve) {
      const agents = recipientsExcept(await emailsFor(supabase, ref.id, "AGENTS"), user.email).filter(
        (e) => e.toLowerCase() !== requester[0]?.toLowerCase()
      );
      await notifySupplyReadyToDeliver(ref, agents);
    }
  }

  revalidateSupply(parsed.data.requestId);
  return { ok: true };
}

// ---------- IT: entregar (desconta stock + emite guia) ----------
export async function deliverSupplyRequest(
  requestId: string,
  receivedBy: string
): Promise<SupplyActionState> {
  await requirePermission("ticket:handle");
  const parsed = deliverSchema.safeParse({ requestId, receivedBy });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("deliver_supply_request", {
    p_id: parsed.data.requestId,
    p_received_by: parsed.data.receivedBy,
  });
  if (error || !data) return { error: supplyErrorMessage(error) };

  const result = data as {
    guide_id: string;
    guide_number: string;
    low_items: { name: string; stock_qty: number; min_stock: number }[];
  };

  // A partir daqui a entrega JÁ está feita e o stock descontado: falhas de
  // PDF/email nunca devem desfazer ou reportar erro (a guia pode ser
  // descarregada na página do pedido a qualquer momento).
  try {
    const { data: guide } = await supabase
      .from("delivery_guides")
      .select(
        "number, issued_at, issued_by_name, received_by_name, requester_name, store_name, lines, supply_requests(number, notes)"
      )
      .eq("id", result.guide_id)
      .single();

    const req = guide?.supply_requests as unknown as { number: string; notes: string | null } | null;
    const ref = { id: parsed.data.requestId, number: req?.number ?? "" };

    if (guide && ref.number) {
      const pdf = await buildGuidePdf({
        number: guide.number,
        requestNumber: ref.number,
        issuedAt: guide.issued_at,
        issuedByName: guide.issued_by_name,
        receivedByName: guide.received_by_name,
        requesterName: guide.requester_name,
        storeName: guide.store_name,
        notes: req?.notes ?? null,
        lines: guide.lines as GuideLine[],
        logoPng: await loadLogoPng(),
      });
      const requester = await emailsFor(supabase, ref.id, "REQUESTER");
      if (requester[0]) await notifySupplyDelivered(ref, requester[0], guide.number, pdf);
    }

    if (result.low_items.length > 0) {
      await notifyLowStock(await emailsFor(supabase, parsed.data.requestId, "AGENTS"), result.low_items);
    }
  } catch (err) {
    console.error("[supply] entrega registada, mas falhou o PDF/email:", err);
  }

  revalidateSupply(parsed.data.requestId);
  return { ok: true };
}
