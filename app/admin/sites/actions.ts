"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { siteSchema } from "@/lib/validation/site";

export type SiteFormState = {
  values?: { code?: string; name?: string; type?: string };
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createSite(
  _prev: SiteFormState,
  formData: FormData
): Promise<SiteFormState> {
  await requirePermission("admin:manage");

  const raw = {
    code: String(formData.get("code") ?? ""),
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? ""),
  };

  const parsed = siteSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path[0] as string] ??= issue.message;
    }
    return { values: raw, fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("stores").insert(parsed.data);

  // unique_violation: código ou nome já existem
  if (error?.code === "23505") {
    return { values: raw, error: "Já existe um site com esse código ou nome." };
  }
  if (error) {
    return { values: raw, error: "Não foi possível criar o site." };
  }

  revalidatePath("/admin/sites");
  redirect("/admin/sites");
}

export async function updateSite(
  siteId: string,
  _prev: SiteFormState,
  formData: FormData
): Promise<SiteFormState> {
  await requirePermission("admin:manage");

  const raw = {
    code: String(formData.get("code") ?? ""),
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? ""),
  };

  const parsed = siteSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path[0] as string] ??= issue.message;
    }
    return { values: raw, fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("stores")
    .update(parsed.data)
    .eq("id", siteId);

  if (error?.code === "23505") {
    return { values: raw, error: "Já existe um site com esse código ou nome." };
  }
  if (error) {
    return { values: raw, error: "Não foi possível guardar as alterações." };
  }

  revalidatePath("/admin/sites");
  redirect("/admin/sites");
}

export async function toggleSiteActive(siteId: string, nextValue: boolean) {
  await requirePermission("admin:manage");
  const supabase = await createClient();

  // Não apagamos sites (tickets antigos continuam a referenciá-los).
  // Desactivar impede novos tickets nesse site (trigger tickets_before_insert).
  const { error } = await supabase
    .from("stores")
    .update({ is_active: nextValue })
    .eq("id", siteId);

  if (error) throw new Error("Não foi possível actualizar o site.");
  revalidatePath("/admin/sites");
}