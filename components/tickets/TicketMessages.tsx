"use client";

import { useRef, useEffect, useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { FieldError, fieldControlCss } from "@/components/ui/Field";
import { Stack, MutedText } from "@/components/layout/Stack";
import { AttachmentPicker } from "@/components/tickets/AttachmentPicker";
import { AttachmentList, type AttachmentRow } from "@/components/tickets/AttachmentList";
import { createClient } from "@/lib/supabase/client";
import { uploadFiles } from "@/lib/attachments/client";
import { addMessage } from "@/app/tickets/actions";

export type MessageRow = {
  id: string;
  body: string;
  created_at: string;
  authorName: string;
  isOwn: boolean;
  attachments: AttachmentRow[];
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

const BubbleMeta = styled.div`
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

const TypingRow = styled.p`
  margin: 0;
  min-height: 18px; /* evita o layout "saltar" quando o indicador aparece/desaparece */
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-style: italic;
  color: ${({ theme }) => theme.colors.textMuted};
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

const TYPING_BROADCAST_INTERVAL = 2000; // não enviar a cada tecla, só de 2 em 2s
const TYPING_EXPIRES_AFTER = 4000; // esconde "a escrever" se não chegar outro sinal
const REFRESH_DEBOUNCE = 400; // junta mensagem + anexos num só refresh

export function TicketMessages({
  ticketId,
  messages,
  canReply,
  currentUserName,
}: {
  ticketId: string;
  messages: MessageRow[];
  canReply: boolean;
  currentUserName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  // Preenchido quando a mensagem foi enviada mas alguns anexos falharam:
  // permite reenviar SÓ os anexos, para a mesma mensagem.
  const [retry, setRetry] = useState<{ messageId: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftKey = `noa-helpdesk:draft:${ticketId}`;
  const threadEndRef = useRef<HTMLDivElement>(null);
  const [typingName, setTypingName] = useState<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentTypingRef = useRef(0);

  // Canal privado por ticket: a autorização (quem pode entrar) é decidida
  // pelas RLS policies em realtime.messages (migração 0004), não aqui.
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(
    null
  );

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    (async () => {
      // Necessário antes de qualquer canal privado — associa o token da
      // sessão à ligação Realtime, para as policies terem o auth.uid() certo.
      await supabase.realtime.setAuth();
      if (!active) return;

      const channel = supabase
        .channel(`ticket:${ticketId}`, { config: { private: true } })
        .on("broadcast", { event: "INSERT" }, () => {
          // Chega para mensagens e para anexos. Não confiamos no conteúdo do
          // payload: voltamos a pedir os dados ao servidor, já filtrados por RLS.
          if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE);
        })
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          if (payload?.name && payload.name !== currentUserName) {
            setTypingName(payload.name);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(
              () => setTypingName(null),
              TYPING_EXPIRES_AFTER
            );
          }
        })
        .subscribe();

      channelRef.current = channel;
    })();

    return () => {
      active = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const handleTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSentTypingRef.current < TYPING_BROADCAST_INTERVAL) return;
    lastSentTypingRef.current = now;
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { name: currentUserName },
    });
  }, [currentUserName]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // Rascunho por pedido: se a ligação cair e a página recarregar, o texto volta.
  // sessionStorage (e não localStorage): desaparece ao fechar o separador, o que
  // importa em computadores partilhados. É apagado assim que a mensagem sai.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(draftKey);
      const field = textareaRef.current;
      if (saved && field && !field.value) field.value = saved;
    } catch {
      // armazenamento indisponível (modo privado): segue sem rascunho
    }
  }, [draftKey]);

  function saveDraft(text: string) {
    try {
      if (text) sessionStorage.setItem(draftKey, text);
      else sessionStorage.removeItem(draftKey);
    } catch {
      // ignora
    }
  }

  async function sendAttachments(messageId: string, toSend: File[]) {
    const outcome = await uploadFiles({
      ticketId,
      messageId,
      files: toSend,
      onProgress: (current, total) => setProgress(`A enviar anexos (${current}/${total})...`),
    });
    setProgress(null);

    if (outcome.failedFiles.length > 0) {
      // A mensagem JÁ foi enviada: guardamos só os anexos que falharam para reenvio
      setFiles(outcome.failedFiles);
      setRetry({ messageId });
      setError(
        `A mensagem foi enviada, mas ${outcome.failedFiles.length} anexo(s) falharam: ${
          outcome.firstError ?? "erro desconhecido"
        }`
      );
    } else {
      setFiles([]);
      setRetry(null);
    }
    router.refresh();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget; // capturar antes de qualquer await
    const formData = new FormData(form);
    setError(null);

    startTransition(async () => {
      // 1) a mensagem (só texto). Qualquer falha deixa o texto no campo.
      let messageId: string | undefined;
      try {
        const result = await addMessage({}, formData);
        if (result.error || !result.messageId) {
          setError(result.error ?? "Não foi possível enviar a mensagem.");
          return;
        }
        messageId = result.messageId;
      } catch {
        // Sem rede / servidor inacessível: sem este catch o React mostraria
        // uma página de erro e o texto escrito perdia-se.
        setError(
          "Sem ligação ao servidor. A mensagem não foi enviada — o texto continua aqui, tenta de novo."
        );
        return;
      }

      form.reset();
      saveDraft("");

      // 2) os anexos, ligados a essa mensagem
      if (files.length > 0) {
        await sendAttachments(messageId, files);
      } else {
        router.refresh();
      }
    });
  }

  function handleRetryAttachments() {
    if (!retry) return;
    setError(null);
    startTransition(async () => {
      await sendAttachments(retry.messageId, files);
    });
  }

  function discardRetry() {
    setRetry(null);
    setFiles([]);
    setError(null);
  }

  return (
    <Stack $gap="sm">
      <h3 style={{ margin: 0, fontSize: 16 }}>Conversação</h3>

      {messages.length === 0 ? (
        <MutedText>Ainda não há mensagens.</MutedText>
      ) : (
        <Thread>
          {messages.map((m) => (
            <Bubble key={m.id} $isOwn={m.isOwn}>
              <BubbleMeta>
                {m.authorName} · {formatTime(m.created_at)}
              </BubbleMeta>
              <BubbleBody>{m.body}</BubbleBody>
              <AttachmentList items={m.attachments} />
            </Bubble>
          ))}
          <div ref={threadEndRef} />
        </Thread>
      )}

      <TypingRow aria-live="polite">
        {typingName ? `${typingName} está a escrever...` : ""}
      </TypingRow>

      {canReply && retry ? (
        // Modo "reenviar anexos": a mensagem já saiu, falta só alguns ficheiros
        <div style={{ display: "grid", gap: 8 }}>
          <AttachmentPicker files={files} onChange={setFiles} disabled={pending} />
          {error && <FieldError role="alert">{error}</FieldError>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button type="button" $variant="secondary" onClick={discardRetry} disabled={pending}>
              Descartar anexos
            </Button>
            <Button
              type="button"
              onClick={handleRetryAttachments}
              disabled={pending || files.length === 0}
            >
              {pending ? (progress ?? "A enviar...") : "Reenviar anexos"}
            </Button>
          </div>
        </div>
      ) : canReply ? (
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8 }}>
          <TextArea
            ref={textareaRef}
            name="body"
            placeholder="Escreve uma mensagem..."
            maxLength={5000}
            required
            onChange={(e) => {
              handleTyping();
              saveDraft(e.target.value);
            }}
            disabled={pending}
          />
          <input type="hidden" name="ticketId" value={ticketId} />
          <AttachmentPicker files={files} onChange={setFiles} disabled={pending} />
          {error && <FieldError role="alert">{error}</FieldError>}
          <Button type="submit" disabled={pending} style={{ justifySelf: "end" }}>
            {pending ? (progress ?? "A enviar...") : error ? "Tentar de novo" : "Enviar"}
          </Button>
        </form>
      ) : (
        <MutedText>Este ticket está fechado — não é possível enviar novas mensagens.</MutedText>
      )}
    </Stack>
  );
}