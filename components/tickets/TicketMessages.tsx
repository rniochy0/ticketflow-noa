"use client";

import { useActionState, useRef, useEffect } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { FieldError, fieldControlCss } from "@/components/ui/Field";
import { Stack, MutedText } from "@/components/layout/Stack";
import { addMessage, type AddMessageState } from "@/app/tickets/actions";

export type MessageRow = {
  id: string;
  body: string;
  created_at: string;
  authorName: string;
  isOwn: boolean;
};

const Thread = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
  max-height: 420px;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.background};
  border-radius: ${({ theme }) => theme.radius.md};
`;

const Bubble = styled.div<{ $isOwn: boolean }>`
  justify-self: ${({ $isOwn }) => ($isOwn ? "end" : "start")};
  max-width: 80%;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme, $isOwn }) => ($isOwn ? theme.colors.primary : theme.colors.surface)};
  color: ${({ theme, $isOwn }) => ($isOwn ? "#fff" : theme.colors.text)};
  border: 1px solid ${({ theme, $isOwn }) => ($isOwn ? "transparent" : theme.colors.border)};
`;

const BubbleMeta = styled.div<{ $isOwn: boolean }>`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  opacity: 0.8;
  margin-bottom: 2px;
`;

// white-space:pre-wrap preserva quebras de linha sem precisar de HTML —
// o texto do utilizador nunca passa por dangerouslySetInnerHTML,
// o React escapa-o automaticamente, por isso não há risco de XSS aqui.
const BubbleBody = styled.p`
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: break-word;
`;

const TextArea = styled.textarea`
  ${fieldControlCss}
  min-height: 72px;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  font: inherit;
  resize: vertical;
`;

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TicketMessages({
  ticketId,
  messages,
  canReply,
}: {
  ticketId: string;
  messages: MessageRow[];
  canReply: boolean;
}) {
  const [state, formAction, pending] = useActionState<AddMessageState, FormData>(
    addMessage,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Limpa o campo depois de um envio bem sucedido (sem erro)
  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [pending, state.error]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <Stack $gap="sm">
      <h3 style={{ margin: 0, fontSize: 16 }}>Conversação</h3>

      {messages.length === 0 ? (
        <MutedText>Ainda não há mensagens.</MutedText>
      ) : (
        <Thread>
          {messages.map((m) => (
            <Bubble key={m.id} $isOwn={m.isOwn}>
              <BubbleMeta $isOwn={m.isOwn}>
                {m.authorName} · {formatTime(m.created_at)}
              </BubbleMeta>
              <BubbleBody>{m.body}</BubbleBody>
            </Bubble>
          ))}
          <div ref={threadEndRef} />
        </Thread>
      )}

      {canReply ? (
        <form ref={formRef} action={formAction} style={{ display: "grid", gap: 8 }}>
          <input type="hidden" name="ticketId" value={ticketId} />
          <TextArea
            name="body"
            placeholder="Escreve uma mensagem..."
            maxLength={5000}
            required
          />
          {state.error && <FieldError role="alert">{state.error}</FieldError>}
          <Button type="submit" disabled={pending} style={{ justifySelf: "end" }}>
            {pending ? "A enviar..." : "Enviar"}
          </Button>
        </form>
      ) : (
        <MutedText>Este ticket está fechado — não é possível enviar novas mensagens.</MutedText>
      )}
    </Stack>
  );
}
