"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import {
  notifyNewTicket,
  notifyAssigned,
  notifyNewMessage,
  notifyResolved,
} from "@/lib/email/notifications";
import {
  createTicketSchema,
  assignTicketSchema,
  changeStatusSchema,
  changePrioritySchema,
  addMessageSchema,
} from "@/lib/validation/ticket";

export type CreateTicketState = {
  ticketId?: string;
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
    .select("id, number, title")
    .single();

  if (error || !ticket) {
    // Erros de negócio (loja/categoria inactiva, etc.) vêm dos triggers da BD
    return {
      values: { title: raw.title, description: raw.description },
      error: "Não foi possível criar o pedido. Tenta novamente.",
    };
  }

  // Notifica toda a equipa de IT activa — ainda não há responsável definido,
  // por isso é a fila toda a saber que há um pedido novo por assumir.
  const { data: itStaff, error: itStaffError } = await supabase
    .from("profiles")
    .select("email")
    .in("role", ["TECHNICIAN", "ADMIN"])
    .eq("is_active", true);

  if (itStaffError) {
    console.error("[email] falha ao consultar equipa IT:", itStaffError);
  } else if (!itStaff?.length) {
    console.warn("[email] nenhum técnico/admin ativo para receber o novo ticket:", ticket.number);
  }

  await notifyNewTicket(
    ticket,
    (itStaff ?? []).map((p) => p.email)
  );

  revalidatePath("/tickets");
  return { ticketId: ticket.id };
}

// ============ Acções de atendimento (Feature 05.3) ============
// Cada uma valida a permissão primeiro. O RLS e os triggers da BD
// (0002_tickets.sql) são a barreira final — isto aqui é a primeira,
// e existe para dar erro cedo e com boa mensagem.

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function assignToMe(ticketId: string): Promise<ActionResult> {
  const user = await requirePermission("ticket:handle");
  const supabase = await createClient();

  const { error } = await supabase
    .from("tickets")
    .update({ assignee_id: user.id, status: "IN_PROGRESS" })
    .eq("id", ticketId);

  if (error) return { ok: false, error: "Não foi possível assumir o ticket." };
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/it");
  return { ok: true };
}

export async function assignTechnician(
  formData: FormData
): Promise<ActionResult> {
  await requirePermission("ticket:handle");

  const parsed = assignTicketSchema.safeParse({
    ticketId: formData.get("ticketId"),
    technicianId: formData.get("technicianId"),
  });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  const supabase = await createClient();

  // Confirma que o alvo é mesmo um técnico activo antes de gravar — impede
  // atribuir a uma conta desactivada ou a um role que não atende (MANAGER).
  const { data: target } = await supabase
    .from("profiles")
    .select("role, is_active, email")
    .eq("id", parsed.data.technicianId)
    .single();

  if (!target?.is_active || !["TECHNICIAN", "ADMIN"].includes(target.role)) {
    return { ok: false, error: "O responsável tem de ser um técnico activo." };
  }

  const { data: ticket, error } = await supabase
    .from("tickets")
    .update({ assignee_id: parsed.data.technicianId })
    .eq("id", parsed.data.ticketId)
    .select("id, number, title")
    .single();

  if (error || !ticket) return { ok: false, error: "Não foi possível atribuir o técnico." };

  await notifyAssigned(ticket, target.email);

  revalidatePath(`/tickets/${parsed.data.ticketId}`);
  return { ok: true };
}

export async function changeStatus(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = changeStatusSchema.safeParse({
    ticketId: formData.get("ticketId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { ok: false, error: "Estado inválido." };

  const supabase = await createClient();

  // Defesa em profundidade: o trigger da BD (tickets_before_update) já
  // bloqueia isto de qualquer forma, mas verificar aqui primeiro dá uma
  // mensagem clara em vez de um erro de BD genérico, e evita gastar uma
  // escrita para algo que sabemos de antemão que vai falhar.
  const { data: ticket } = await supabase
    .from("tickets")
    .select("status, requester_id, number, title, requester:profiles!tickets_requester_id_fkey(email)")
    .eq("id", parsed.data.ticketId)
    .single();

  if (!ticket) return { ok: false, error: "Ticket não encontrado." };

  const isAgent = can(user.role, "ticket:handle");
  const isRequester = ticket.requester_id === user.id;

  if (!isAgent) {
    // Quem não é da equipa só pode fazer uma coisa: fechar o seu próprio
    // ticket já resolvido. Tudo o resto é recusado aqui, antes de tocar na BD.
    const allowed =
      isRequester && ticket.status === "RESOLVED" && parsed.data.status === "CLOSED";
    if (!allowed) {
      return { ok: false, error: "Não tens permissão para esta alteração." };
    }
  }

  const { error } = await supabase
    .from("tickets")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.ticketId);

  // Ainda pode falhar aqui (ex: outra pessoa mudou o estado entretanto,
  // corrida entre dois pedidos) — o trigger é sempre a última palavra.
  if (error) return { ok: false, error: "Transição de estado não permitida." };

  if (parsed.data.status === "RESOLVED") {
    const requesterEmail = (ticket as unknown as { requester: { email: string } | null })
      .requester?.email;
    if (requesterEmail) {
      await notifyResolved(
        { id: parsed.data.ticketId, number: ticket.number, title: ticket.title },
        requesterEmail
      );
    }
  }

  revalidatePath(`/tickets/${parsed.data.ticketId}`);
  revalidatePath("/it");
  return { ok: true };
}

export async function changePriority(formData: FormData): Promise<ActionResult> {
  await requirePermission("ticket:handle");

  const parsed = changePrioritySchema.safeParse({
    ticketId: formData.get("ticketId"),
    priority: formData.get("priority"),
  });
  if (!parsed.success) return { ok: false, error: "Prioridade inválida." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tickets")
    .update({ priority: parsed.data.priority })
    .eq("id", parsed.data.ticketId);

  if (error) return { ok: false, error: "Não foi possível alterar a prioridade." };
  revalidatePath(`/tickets/${parsed.data.ticketId}`);
  return { ok: true };
}

export type AddMessageState = { error?: string; messageId?: string };

export async function addMessage(
  _prev: AddMessageState,
  formData: FormData
): Promise<AddMessageState> {
  const user = await requireUser();

  const parsed = addMessageSchema.safeParse({
    ticketId: formData.get("ticketId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Mensagem inválida." };
  }

  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from("ticket_messages")
    .insert({
      ticket_id: parsed.data.ticketId,
      author_id: user.id,
      body: parsed.data.body,
    })
    .select("id")
    .single();

  // O RLS de ticket_messages já rejeita mensagens em tickets CLOSED
  // ou de quem não é o solicitante/agente — erro genérico de propósito
  if (error || !inserted) return { error: "Não foi possível enviar a mensagem." };

  // Notifica "o outro lado": se quem respondeu foi o colaborador, avisa o
  // técnico responsável (ou toda a equipa, se ainda não houver um); se foi
  // a equipa a responder, avisa sempre o colaborador que abriu o pedido.
  const { data: ticket } = await supabase
    .from("tickets")
    .select(
      `number, title, requester_id, assignee_id,
       requester:profiles!tickets_requester_id_fkey(email)`
    )
    .eq("id", parsed.data.ticketId)
    .single();

  if (ticket) {
    const ticketRef = { id: parsed.data.ticketId, number: ticket.number, title: ticket.title };
    const authorIsRequester = ticket.requester_id === user.id;

    if (authorIsRequester) {
      if (ticket.assignee_id) {
        const { data: assignee } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", ticket.assignee_id)
          .single();
        if (assignee?.email) await notifyNewMessage(ticketRef, assignee.email, user.fullName);
      } else {
        const { data: itStaff } = await supabase
          .from("profiles")
          .select("email")
          .in("role", ["TECHNICIAN", "ADMIN"])
          .eq("is_active", true);
        for (const p of itStaff ?? []) {
          await notifyNewMessage(ticketRef, p.email, user.fullName);
        }
      }
    } else {
      const requesterEmail = (ticket as unknown as { requester: { email: string } | null })
        .requester?.email;
      if (requesterEmail) await notifyNewMessage(ticketRef, requesterEmail, user.fullName);
    }
  }

  revalidatePath(`/tickets/${parsed.data.ticketId}`);
  return { messageId: inserted.id };
}