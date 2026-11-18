import { z } from "zod";

export const SUPPLY_KIND_VALUES = ["TONER", "PERIFERICO", "MONITOR", "OUTRO"] as const;

export const MAX_LINES = 20;
export const MAX_QTY = 50;

// ---------- pedido ----------
export const supplyNotesSchema = z
  .string()
  .trim()
  .max(500, "As notas não podem passar de 500 caracteres");

export type SupplyLine = { itemId: string; qty: number };

// O formulário envia um campo "qty_<uuid>" por artigo. Tudo é validado aqui
// (uuid, inteiro, limites) antes de chegar à BD, que volta a validar.
export function parseSupplyLines(
  formData: FormData
): { lines: SupplyLine[] } | { error: string } {
  const lines: SupplyLine[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("qty_")) continue;
    const raw = String(value).trim();
    if (raw === "" || raw === "0") continue;

    const itemId = key.slice(4);
    if (!z.uuid().safeParse(itemId).success) return { error: "Artigo inválido." };
    if (!/^\d{1,3}$/.test(raw)) return { error: "Indica quantidades inteiras (1 a 50)." };

    const qty = Number(raw);
    if (qty < 1 || qty > MAX_QTY) return { error: `A quantidade máxima por artigo é ${MAX_QTY}.` };
    if (lines.some((l) => l.itemId === itemId)) return { error: "Artigo repetido." };
    lines.push({ itemId, qty });
  }
  if (lines.length === 0) return { error: "Escolhe pelo menos um artigo." };
  if (lines.length > MAX_LINES) return { error: `Máximo de ${MAX_LINES} artigos por pedido.` };
  return { lines };
}

// ---------- decisões / entrega ----------
export const decideSchema = z.object({
  requestId: z.uuid("Pedido inválido"),
  approve: z.boolean(),
  note: z.string().trim().max(300, "A nota não pode passar de 300 caracteres"),
});

export const deliverSchema = z.object({
  requestId: z.uuid("Pedido inválido"),
  receivedBy: z
    .string()
    .trim()
    .min(2, "Indica quem recebeu")
    .max(120, "O nome não pode passar de 120 caracteres"),
});

export const requestIdSchema = z.object({ requestId: z.uuid("Pedido inválido") });

// ---------- catálogo / stock ----------
const itemFields = {
  name: z.string().trim().min(2, "O nome deve ter pelo menos 2 caracteres").max(100, "Máximo de 100 caracteres"),
  ref: z.string().trim().max(50, "A referência não pode passar de 50 caracteres"),
  kind: z.enum(SUPPLY_KIND_VALUES),
  unit: z.string().trim().min(1, "Indica a unidade").max(20, "Máximo de 20 caracteres"),
  minStock: z.coerce.number().int("Usa um número inteiro").min(0, "Não pode ser negativo").max(100000),
};

export const supplyItemSchema = z.object(itemFields);
export const updateSupplyItemSchema = z.object({ id: z.uuid("Artigo inválido"), ...itemFields });
export const toggleSupplyItemSchema = z.object({ id: z.uuid("Artigo inválido"), next: z.boolean() });

export const adjustStockSchema = z.object({
  itemId: z.uuid("Artigo inválido"),
  delta: z.coerce
    .number()
    .int("Usa um número inteiro")
    .refine((n) => n !== 0, "A quantidade não pode ser 0")
    .refine((n) => Math.abs(n) <= 10000, "Quantidade demasiado grande"),
  reason: z.string().trim().min(3, "Indica o motivo").max(200, "Máximo de 200 caracteres"),
});
