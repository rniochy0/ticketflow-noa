import "server-only";
import { resend, EMAIL_FROM, APP_URL, EMAIL_DEV_REDIRECT } from "./client";

type TicketRef = { id: string; number: string; title: string };

// Nunca interpolamos texto do utilizador (título, nome) sem escapar —
// isto vai para um cliente de email em HTML, o mesmo cuidado de um XSS normal.
function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string
  );
}

function ticketLink(ticket: TicketRef) {
  return `${APP_URL}/tickets/${ticket.id}`;
}

// Nunca inclui a descrição do ticket nem o corpo das mensagens no email —
// só número, título e um link que exige login para ver o conteúdo real.
// Reduz o que fica exposto numa caixa de correio fora do nosso controlo.
function wrapper(heading: string, bodyHtml: string, ticket: TicketRef) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="margin-bottom: 4px;">${heading}</h2>
      <p style="color:#6b7280; margin-top:0;">${escapeHtml(ticket.number)} — ${escapeHtml(ticket.title)}</p>
      ${bodyHtml}
      <p style="margin-top:24px;">
        <a href="${ticketLink(ticket)}" style="background:#0a6cff;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Abrir ticket</a>
      </p>
    </div>
  `;
}

// Texto curto e sem conteúdo sensível (só número, título, link). Os rótulos
// ficam aqui porque este módulo é só de servidor.
const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};
export const priorityLabel = (p: string) => PRIORITY_LABELS[p] ?? p;

// Evita email para quem fez a ação e duplicados
export function recipientsExcept(
  emails: (string | null | undefined)[],
  actorEmail: string
): string[] {
  const me = actorEmail.toLowerCase();
  return [...new Set(emails.filter((e): e is string => !!e && e.toLowerCase() !== me))];
}

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

// O SDK do Resend NÃO lança excepção quando recusa um envio: devolve
// { data, error }. Tratar só com try/catch faz as recusas (chave inválida,
// remetente não verificado, destinatário não permitido) passarem em silêncio.
// O resultado é devolvido para quem chama poder reagir (ex: a página de teste).
async function send(to: string | string[], subject: string, html: string): Promise<SendResult> {
  let recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (recipients.length === 0) return { ok: false, error: "Sem destinatários." };

  if (EMAIL_DEV_REDIRECT) {
    subject = `[DEV → ${recipients.length} destinatário(s)] ${subject}`;
    recipients = [EMAIL_DEV_REDIRECT];
  }

  if (!resend) {
    console.warn("[email] RESEND_API_KEY não definido — email não enviado:", subject);
    return { ok: false, error: "A variável RESEND_API_KEY não está definida no servidor." };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: recipients,
      subject,
      html,
    });
    if (error || !data) {
      console.error("[email] o Resend recusou o envio:", subject, "→", error?.name, error?.message);
      return { ok: false, error: error?.message ?? "Resposta vazia do Resend." };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    // Falha de rede/ligação. Uma falha de email nunca deve rebentar a acção
    // principal (criar ticket, responder, mudar estado): fica só registada.
    console.error("[email] falha de ligação ao Resend:", err);
    return { ok: false, error: "Falha de ligação ao Resend." };
  }
}

export async function notifyNewTicket(ticket: TicketRef, itEmails: string[]) {
  await send(
    itEmails,
    `Novo pedido ${ticket.number}`,
    wrapper(
      "Novo pedido de suporte",
      `<p>Foi aberto um novo pedido que precisa de atenção.</p>`,
      ticket
    )
  );
}

// O colaborador fica a saber que o IT abriu um pedido por ele (telefone/presencial)
export async function notifyOpenedOnBehalf(
  ticket: TicketRef,
  requesterEmail: string,
  agentName: string
) {
  await send(
    requesterEmail,
    `Pedido aberto em teu nome: ${ticket.number}`,
    wrapper(
      "Abrimos um pedido em teu nome",
      `<p><strong>${escapeHtml(agentName)}</strong> registou este pedido de suporte em teu nome. Podes acompanhá-lo e responder pelo link.</p>`,
      ticket
    )
  );
}

export async function notifyAssigned(ticket: TicketRef, technicianEmail: string) {
  await send(
    technicianEmail,
    `Ticket atribuído: ${ticket.number}`,
    wrapper(
      "Um ticket foi-te atribuído",
      `<p>Foste designado como responsável por este pedido.</p>`,
      ticket
    )
  );
}

export async function notifyNewMessage(
  ticket: TicketRef,
  recipients: string | string[],
  authorName: string
) {
  await send(
    recipients,
    `Nova resposta em ${ticket.number}`,
    wrapper(
      "Nova resposta",
      `<p><strong>${escapeHtml(authorName)}</strong> respondeu neste pedido.</p>`,
      ticket
    )
  );
}

export async function notifyResolved(ticket: TicketRef, requesterEmail: string) {
  await send(
    requesterEmail,
    `Pedido resolvido: ${ticket.number}`,
    wrapper(
      "O teu pedido foi resolvido",
      `<p>O técnico marcou este pedido como resolvido. Confirma se já podes fechá-lo.</p>`,
      ticket
    )
  );
}

// Só para a página de teste do admin. Envia sempre para o email do próprio
// admin autenticado (nunca para um endereço escolhido), para não servir
// de "relay" de email.
export async function sendTestEmail(to: string): Promise<SendResult> {
  return send(
    to,
    "Teste de email — NOA HelpDesk",
    `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Email de teste</h2>
      <p>Se estás a ler isto, o envio de emails do NOA HelpDesk está a funcionar.</p>
    </div>`
  );
}

// ---------- Notificações genéricas de tickets (curtas) ----------
// Ex: "Maria assumiu o teu pedido." — actorName em negrito, texto escapado.
export async function notifyTicketUpdate(
  ticket: TicketRef,
  recipients: string | string[],
  heading: string,
  text: string,
  actorName?: string
) {
  const who = actorName ? `<strong>${escapeHtml(actorName)}</strong> ` : "";
  await send(
    recipients,
    `${heading}: ${ticket.number}`,
    wrapper(heading, `<p>${who}${escapeHtml(text)}</p>`, ticket)
  );
}

// ---------- Emails de conta (sem ticket) ----------
function plainWrapper(heading: string, bodyHtml: string, cta?: { label: string; href: string }) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="margin-bottom: 8px;">${heading}</h2>
      ${bodyHtml}
      ${
        cta
          ? `<p style="margin-top:24px;"><a href="${cta.href}" style="background:#0a6cff;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">${escapeHtml(cta.label)}</a></p>`
          : ""
      }
    </div>
  `;
}

const passwordBox = (pw: string) =>
  `<p style="font-family: monospace; font-size: 18px; background:#f3f4f6; padding:10px 14px; border-radius:8px; display:inline-block;">${escapeHtml(pw)}</p>`;

// Contém a password temporária — única mensagem que o faz, a pedido do negócio.
// Mitigações: a conta é obrigada a trocá-la no 1.º acesso (ver proxy.ts) e a
// password nunca é registada em logs.
export async function notifyWelcome(email: string, name: string, tempPassword: string) {
  return send(
    email,
    "A tua conta NOA HelpDesk",
    plainWrapper(
      "Bem-vindo(a) ao NOA HelpDesk",
      `<p>Olá ${escapeHtml(name || "")}, a tua conta foi criada.</p>
       <p>Email: <strong>${escapeHtml(email)}</strong><br/>Password temporária:</p>
       ${passwordBox(tempPassword)}
       <p>No primeiro acesso vais ter de definir uma password nova.</p>`,
      { label: "Entrar", href: `${APP_URL}/login` }
    )
  );
}

export async function notifyPasswordReset(email: string, name: string, tempPassword: string) {
  return send(
    email,
    "Nova password temporária — NOA HelpDesk",
    plainWrapper(
      "Password redefinida",
      `<p>Olá ${escapeHtml(name || "")}, o IT redefiniu a tua password.</p>
       <p>Password temporária:</p>
       ${passwordBox(tempPassword)}
       <p>No próximo acesso vais ter de definir uma password nova.</p>`,
      { label: "Entrar", href: `${APP_URL}/login` }
    )
  );
}

// Alerta de segurança: se não foste tu, o utilizador sabe que deve avisar o IT
export async function notifyPasswordChanged(email: string, name: string) {
  return send(
    email,
    "A tua password foi alterada — NOA HelpDesk",
    plainWrapper(
      "Password alterada",
      `<p>Olá ${escapeHtml(name || "")}, a password da tua conta foi alterada.</p>
       <p>Se não foste tu, contacta o IT de imediato.</p>`
    )
  );
}

export async function notifyAccountChange(email: string, name: string, message: string) {
  return send(
    email,
    "Alteração na tua conta — NOA HelpDesk",
    plainWrapper(
      "Alteração na tua conta",
      `<p>Olá ${escapeHtml(name || "")},</p><p>${escapeHtml(message)}</p>`
    )
  );
}