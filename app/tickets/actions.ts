"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { createTicketSchema } from "@/lib/validation/ticket";

export type CreateTicketState = {
  values?: { title?: string; description?: string };
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createTicket(
  _prev: CreateTicketState,
  formData: FormData
): Promise<CreateTicketState> {
  const user = await requirePermission("ticket:create");

  const raw = {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    subcategoryId: String(formData.get("subcategoryId") ?? ""),
    priority: String(formData.get("priority") ?? ""),
  };

  const parsed = createTicketSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as string;
      fieldErrors[key] ??= issue.message;
    }
    return {
      values: { title: raw.title, description: raw.description },
      fieldErrors,
    };
  }

  const supabase = await createClient();

  // A loja vem sempre do perfil do próprio utilizador, nunca do formulário:
  // impede um colaborador de abrir tickets em nome de outra loja.
  const { data: profile } = await supabase
    .from("profiles")
    .select("store_id")
    .eq("id", user.id)
    .single();

  if (!profile?.store_id) {
    return {
      values: { title: raw.title, description: raw.description },
      error: "A tua conta não tem loja associada. Contacta o administrador.",
    };
  }

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description,
      category_id: parsed.data.categoryId,
      subcategory_id: parsed.data.subcategoryId || null,
      store_id: profile.store_id,
      priority: parsed.data.priority,
      requester_id: user.id,
    })
    .select("id")
    .single();

  if (error || !ticket) {
    // Erros de negócio (loja/categoria inactiva, etc.) vêm dos triggers da BD
    return {
      values: { title: raw.title, description: raw.description },
      error: "Não foi possível criar o pedido. Tenta novamente.",
    };
  }

  revalidatePath("/tickets");
  redirect(`/tickets/${ticket.id}`);
}