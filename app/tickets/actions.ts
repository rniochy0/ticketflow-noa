"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import {
  notifyNewTicket,
  notifyOpenedOnBehalf,
  notifyTicketUpdate,
  recipientsExcept,
  priorityLabel,
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
    requesterId: String(formData.get("requesterId") ?? ""),
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

  // Em nome de outro colaborador: só quem atende (TECHNICIAN/MANAGER/ADMIN). Mesmo que
  // alguém forje o campo, o RLS da BD também recusa para quem não é agente.
  const onBehalf = parsed.data.requesterId && parsed.data.requesterId !== user.id;
  if (onBehalf && !can(user.role, "ticket:handle")) {
    return {
      values: { title: raw.title, description: raw.description },
      error: "Não tens permissão para abrir pedidos em nome de outra pessoa.",
    };
  }
  const requesterId = onBehalf ? (parsed.data.requesterId as string) : user.id;

  // A loja vem sempre do perfil do SOLICITANTE, nunca do formulário:
  // impede abrir tickets em nome de outra loja.
  const { data: profile } = await supabase
    .from("profiles")
    .select("store_id, is_active")
    .eq("id", requesterId)
    .single();

  if (!profile?.is_active) {
    return {
      values: { title: raw.title, description: raw.description },
      error: "Colaborador inválido ou inativo.",
    };
  }
  if (!profile.store_id) {
    return {
      values: { title: raw.title, description: raw.description },
      error: onBehalf
        ? "Este colaborador não tem site associado. Define-o em Administração → Utilizadores."
        : "A tua conta não tem loja associada. Contacta o administrador.",
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
      requester_id: requesterId,
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

  // Notifica toda a equipa de IT activa. Usa uma função SQL (security definer)
  // porque o RLS não deixa o colaborador ler os perfis do IT directamente.
  const { data: itStaff } = await supabase.rpc("ticket_staff_emails", {
    p_ticket_id: ticket.id,
  });

  await notifyNewTicket(
    ticket,
    ((itStaff ?? []) as { email: string }[]).map((p) => p.email)
  );

  if (onBehalf) {
    // Só o IT chega aqui (verificado acima); o RLS deixa a equipa ler o email
    const { data: requester } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", requesterId)
      .single();
    if (requester?.email) {
      await notifyOpenedOnBehalf(ticket, requester.email, user.fullName || user.email);
    }
  }

  revalidatePath("/tickets");
  return { ticketId: ticket.id };
}

// ============ Acções de atendimento (Feature 05.3) ============
// Cada uma valida a permissão primeiro. O RLS e os triggers da BD
// (0002_tickets.sql) são a barreira final — isto aqui é a primeira,
// e existe para dar erro cedo e com boa mensagem.

export type ActionResult = { ok: true } | { ok: false; error: string };

const STATUS_PT: Record<string, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em atendimento",
  WAITING_USER: "Aguarda resposta",
  RESOLVED: "Resolvido",
  CLOSED: "Fechado",
};
const statusLabelPt = (s: string) => STATUS_PT[s] ?? s;

type Supa = Awaited<ReturnType<typeof createClient>>;
type TicketWithRequester = {
  id: string;
  number: string;
  title: string;
  requester: { email: string } | null;
};

// Email do responsável via função SQL (o solicitante não lê perfis do IT)
async function assigneeEmailOf(supabase: Supa, ticketId: string): Promise<string | null> {
  const { data } = await supabase.rpc("ticket_assignee_email", { p_ticket_id: ticketId });
  return (data as string | null) ?? null;
}

export async function assignToMe(ticketId: string): Promise<ActionResult> {
  const user = await requirePermission("ticket:handle");
  const supabase = await createClient();

  // Só assume tickets NOVOS e sem responsável. A condição vai na própria query:
  // se dois técnicos clicarem ao mesmo tempo, só o primeiro consegue.
  const { data, error } = await supabase
    .from("tickets")
    .update({ assignee_id: user.id, status: "IN_PROGRESS" })
    .eq("id", ticketId)
    .eq("status", "OPEN")
    .is("assignee_id", null)
    .select("id, number, title, requester:profiles!tickets_requester_id_fkey(email)");

  if (error) return { ok: false, error: "Não foi possível assumir o ticket." };
  if (!data || data.length === 0) {
    return { ok: false, error: "Este ticket já foi assumido por outra pessoa." };
  }

  const t = data[0] as unknown as TicketWithRequester;
  await notifyTicketUpdate(
    t,
    recipientsExcept([t.requester?.email], user.email),
    "Pedido em atendimento",
    "assumiu o teu pedido e já está a tratar dele.",
    user.fullName || user.email
  );
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/it");
  return { ok: true };
}

export async function assignTechnician(
  formData: FormData
): Promise<ActionResult> {
  const user = await requirePermission("ticket:handle");

  const parsed = assignTicketSchema.safeParse({
    ticketId: formData.get("ticketId"),
    technicianId: formData.get("technicianId"),
  });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  const supabase = await createClient();

  // Confirma que o alvo é mesmo um técnico activo antes de gravar — impede
  // atribuir a uma conta desactivada ou a um perfil que não atende (COLLABORATOR).
  const { data: target } = await supabase
    .from("profiles")
    .select("role, is_active, email, full_name")
    .eq("id", parsed.data.technicianId)
    .single();

  if (!target?.is_active || !["TECHNICIAN", "MANAGER", "ADMIN"].includes(target.role)) {
    return { ok: false, error: "O responsável tem de ser um técnico activo." };
  }

  const { data: ticket, error } = await supabase
    .from("tickets")
    .update({ assignee_id: parsed.data.technicianId })
    .eq("id", parsed.data.ticketId)
    .select("id, number, title, requester:profiles!tickets_requester_id_fkey(email)")
    .single();

  if (error || !ticket) return { ok: false, error: "Não foi possível atribuir o técnico." };

  const t = ticket as unknown as TicketWithRequester;
  // Quem recebe o ticket é avisado (exceto se se atribuiu a si próprio)...
  if (recipientsExcept([target.email], user.email).length > 0) {
    await notifyAssigned(t, target.email);
  }
  // ...e o colaborador fica a saber quem trata do pedido
  await notifyTicketUpdate(
    t,
    recipientsExcept([t.requester?.email], user.email),
    "Pedido atribuído",
    `atribuiu o teu pedido a ${target.full_name || "um técnico"}.`,
    user.fullName || user.email
  );

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

  // ---- Notificações (curtas; nunca para quem fez a ação) ----
  const ref = { id: parsed.data.ticketId, number: ticket.number, title: ticket.title };
  const requesterEmail =
    (ticket as unknown as { requester: { email: string } | null }).requester?.email ?? null;
  const assigneeEmail = await assigneeEmailOf(supabase, parsed.data.ticketId);
  const actor = user.fullName || user.email;
  const next = parsed.data.status;

  if (isRequester && !isAgent) {
    // O colaborador fechou: avisa o responsável
    await notifyTicketUpdate(
      ref,
      recipientsExcept([assigneeEmail], user.email),
      "Pedido fechado",
      "fechou o pedido.",
      actor
    );
  } else {
    // A equipa mudou o estado: o colaborador recebe a mensagem específica...
    const toRequester = recipientsExcept([requesterEmail], user.email);
    if (toRequester.length > 0) {
      if (next === "RESOLVED") {
        await notifyResolved(ref, toRequester[0]);
      } else if (next === "WAITING_USER") {
        await notifyTicketUpdate(ref, toRequester, "Aguardamos a tua resposta",
          "precisa de uma resposta tua para continuar.", actor);
      } else if (next === "IN_PROGRESS") {
        const reopened = ticket.status === "RESOLVED";
        await notifyTicketUpdate(ref, toRequester,
          reopened ? "Pedido reaberto" : "Pedido em atendimento",
          reopened ? "reabriu o teu pedido." : "retomou o atendimento do teu pedido.", actor);
      } else if (next === "CLOSED") {
        await notifyTicketUpdate(ref, toRequester, "Pedido fechado", "fechou o teu pedido.", actor);
      }
    }
    // ...e o responsável, se não foi ele a mudar, fica a saber
    const toAssignee = recipientsExcept([assigneeEmail], user.email);
    if (toAssignee.length > 0) {
      await notifyTicketUpdate(ref, toAssignee, "Estado alterado",
        `alterou o estado do pedido para ${statusLabelPt(next)}.`, actor);
    }
  }

  revalidatePath(`/tickets/${parsed.data.ticketId}`);
  revalidatePath("/it");
  return { ok: true };
}

export async function changePriority(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("ticket:handle");

  const parsed = changePrioritySchema.safeParse({
    ticketId: formData.get("ticketId"),
    priority: formData.get("priority"),
  });
  if (!parsed.success) return { ok: false, error: "Prioridade inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .update({ priority: parsed.data.priority })
    .eq("id", parsed.data.ticketId)
    .select("id, number, title, requester:profiles!tickets_requester_id_fkey(email)")
    .single();

  if (error || !data) return { ok: false, error: "Não foi possível alterar a prioridade." };

  const t = data as unknown as TicketWithRequester;
  const assigneeEmail = await assigneeEmailOf(supabase, t.id);
  await notifyTicketUpdate(
    t,
    recipientsExcept([t.requester?.email, assigneeEmail], user.email),
    "Prioridade alterada",
    `alterou a prioridade do pedido para ${priorityLabel(parsed.data.priority)}.`,
    user.fullName || user.email
  );
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
        const { data: assigneeEmail } = await supabase.rpc("ticket_assignee_email", {
          p_ticket_id: parsed.data.ticketId,
        });
        if (assigneeEmail) await notifyNewMessage(ticketRef, assigneeEmail as string, user.fullName);
      } else {
        const { data: itStaff } = await supabase.rpc("ticket_staff_emails", {
          p_ticket_id: parsed.data.ticketId,
        });
        const staffEmails = ((itStaff ?? []) as { email: string }[]).map((p) => p.email);
        if (staffEmails.length > 0) {
          await notifyNewMessage(ticketRef, staffEmails, user.fullName);
        }
      }
    } else {
      const requesterEmail = (ticket as unknown as { requester: { email: string } | null })
        .requester?.email;
      // A equipa respondeu: avisa o colaborador e, se for outra pessoa, o responsável
      const assigneeEmail =
        ticket.assignee_id && ticket.assignee_id !== user.id
          ? await assigneeEmailOf(supabase, parsed.data.ticketId)
          : null;
      const to = recipientsExcept([requesterEmail, assigneeEmail], user.email);
      if (to.length > 0) await notifyNewMessage(ticketRef, to, user.fullName);
    }
  }

  revalidatePath(`/tickets/${parsed.data.ticketId}`);
  return { messageId: inserted.id };
}