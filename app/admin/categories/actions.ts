"use server";

import { revalidatePath } from "next/cache";
import type { ZodType } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import {
  categorySchema,
  renameCategorySchema,
  subcategorySchema,
  renameSubcategorySchema,
  toggleSchema,
} from "@/lib/validation/category";

export type NameFormState = { ok?: boolean; error?: string };

const DUPLICATE = "Já existe um registo com esse nome.";
const GENERIC = "Não foi possível guardar. Tenta novamente.";

// Valida o FormData com o schema e devolve o 1.º erro legível
function parse<T>(schema: ZodType<T>, raw: unknown): { data: T } | { error: string } {
  const r = schema.safeParse(raw);
  return r.success ? { data: r.data } : { error: r.error.issues[0]?.message ?? GENERIC };
}

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

// Defesa em profundidade: requirePermission aqui + RLS "admin_write" na BD.
async function run(
  schema: ZodType<any>,
  raw: Record<string, unknown>,
  op: (supabase: Awaited<ReturnType<typeof createClient>>, data: any) => PromiseLike<{ error: { code?: string } | null }>
): Promise<NameFormState> {
  await requirePermission("admin:manage");
  const p = parse(schema, raw);
  if ("error" in p) return { error: p.error };

  const supabase = await createClient();
  const { error } = await op(supabase, p.data);
  if (error?.code === "23505") return { error: DUPLICATE };
  if (error) return { error: GENERIC };

  revalidatePath("/admin/categories");
  return { ok: true };
}

export async function createCategory(_p: NameFormState, fd: FormData) {
  return run(categorySchema, { name: field(fd, "name") }, (s, d) =>
    s.from("categories").insert({ name: d.name })
  );
}

export async function renameCategory(_p: NameFormState, fd: FormData) {
  return run(renameCategorySchema, { id: field(fd, "id"), name: field(fd, "name") }, (s, d) =>
    s.from("categories").update({ name: d.name }).eq("id", d.id)
  );
}

export async function createSubcategory(_p: NameFormState, fd: FormData) {
  return run(
    subcategorySchema,
    { categoryId: field(fd, "categoryId"), name: field(fd, "name") },
    (s, d) => s.from("subcategories").insert({ category_id: d.categoryId, name: d.name })
  );
}

export async function renameSubcategory(_p: NameFormState, fd: FormData) {
  return run(renameSubcategorySchema, { id: field(fd, "id"), name: field(fd, "name") }, (s, d) =>
    s.from("subcategories").update({ name: d.name }).eq("id", d.id)
  );
}

// Nunca apagamos: tickets antigos continuam a referenciar categoria/subcategoria.
// Desactivar só as esconde do formulário de novos pedidos.
export async function toggleCategoryActive(id: string, next: boolean) {
  const r = await run(toggleSchema, { id, next }, (s, d) =>
    s.from("categories").update({ is_active: d.next }).eq("id", d.id)
  );
  if (r.error) throw new Error(r.error);
}

export async function toggleSubcategoryActive(id: string, next: boolean) {
  const r = await run(toggleSchema, { id, next }, (s, d) =>
    s.from("subcategories").update({ is_active: d.next }).eq("id", d.id)
  );
  if (r.error) throw new Error(r.error);
}