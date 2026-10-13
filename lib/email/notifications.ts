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