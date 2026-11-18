"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { supplyErrorMessage } from "@/lib/supply/errors";
import {
  supplyItemSchema,
  updateSupplyItemSchema,
  toggleSupplyItemSchema,
  adjustStockSchema,
} from "@/lib/validation/supply";

export type StockFormState = { ok?: boolean; error?: string };

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "");

function done(): StockFormState {
  revalidatePath("/materiais/stock");
  return { ok: true };
}

// Catálogo: só gestor/admin (requirePermission + RLS + privilégios de coluna).
// O stock NUNCA é escrito aqui: só através de adjust_supply_stock / entregas.
export async function createSupplyItem(_p: StockFormState, fd: FormData): Promise<StockFormState> {
  await requirePermission("admin:manage");
  const parsed = supplyItemSchema.safeParse({
    name: field(fd, "name"),
    ref: field(fd, "ref"),
    kind: field(fd, "kind"),
    unit: field(fd, "unit") || "un",
    minStock: field(fd, "minStock") || "0",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.from("supply_items").insert({
    name: parsed.data.name,
    ref: parsed.data.ref || null,
    kind: parsed.data.kind,
    unit: parsed.data.unit,
    min_stock: parsed.data.minStock,
  });
  if (error?.code === "23505") return { error: "Já existe um artigo com esse nome." };
  if (error) return { error: supplyErrorMessage(error, "Não foi possível guardar. Tenta novamente.") };
  return done();
}

export async function updateSupplyItem(_p: StockFormState, fd: FormData): Promise<StockFormState> {
  await requirePermission("admin:manage");
  const parsed = updateSupplyItemSchema.safeParse({
    id: field(fd, "id"),
    name: field(fd, "name"),
    ref: field(fd, "ref"),
    kind: field(fd, "kind"),
    unit: field(fd, "unit"),
    minStock: field(fd, "minStock"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("supply_items")
    .update({
      name: parsed.data.name,
      ref: parsed.data.ref || null,
      kind: parsed.data.kind,
      unit: parsed.data.unit,
      min_stock: parsed.data.minStock,
    })
    .eq("id", parsed.data.id);
  if (error?.code === "23505") return { error: "Já existe um artigo com esse nome." };
  if (error) return { error: supplyErrorMessage(error, "Não foi possível guardar. Tenta novamente.") };
  return done();
}

// Nunca apagamos: pedidos e guias antigos referenciam o artigo.
export async function toggleSupplyItemActive(id: string, next: boolean): Promise<StockFormState> {
  await requirePermission("admin:manage");
  const parsed = toggleSupplyItemSchema.safeParse({ id, next });
  if (!parsed.success) return { error: "Artigo inválido." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("supply_items")
    .update({ is_active: parsed.data.next })
    .eq("id", parsed.data.id);
  if (error) return { error: supplyErrorMessage(error) };
  return done();
}

// Entrada/saída avulsa (compra, contagem, perda): técnico, gestor e admin
export async function adjustSupplyStock(_p: StockFormState, fd: FormData): Promise<StockFormState> {
  await requirePermission("ticket:handle");
  const parsed = adjustStockSchema.safeParse({
    itemId: field(fd, "itemId"),
    delta: field(fd, "delta"),
    reason: field(fd, "reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_supply_stock", {
    p_item_id: parsed.data.itemId,
    p_delta: parsed.data.delta,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: supplyErrorMessage(error) };
  return done();
}
