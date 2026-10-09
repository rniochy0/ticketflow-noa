import "server-only";
import { resend, EMAIL_FROM, APP_URL } from "./client";

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

async function send(to: string | string[], subject: string, html: string) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (recipients.length === 0) return;

  if (!resend) {
    console.warn("[email] RESEND_API_KEY não definido — email não enviado:", subject);
    return;
  }

  try {
    await resend.emails.send({ from: EMAIL_FROM, to: recipients, subject, html });
  } catch (err) {
    // Uma falha no envio de email nunca deve rebentar a acção principal
    // (criar ticket, responder, mudar estado) — só fica registada aqui.
    console.error("[email] falha ao enviar:", err);
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
  recipientEmail: string,
  authorName: string
) {
  await send(
    recipientEmail,
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