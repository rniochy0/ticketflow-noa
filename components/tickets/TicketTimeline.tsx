"use client";

import styled from "styled-components";
import { MutedText } from "@/components/layout/Stack";
import { statusLabels } from "@/components/ui/Badge";

export type TimelineEvent = {
  id: string;
  type: string;
  actorId: string | null;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
};

const List = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Item = styled.li`
  display: grid;
  gap: 2px;
  padding-left: ${({ theme }) => theme.spacing.md};
  border-left: 2px solid ${({ theme }) => theme.colors.border};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

const Summary = styled.summary`
  cursor: pointer;
  font-weight: 600;
`;

function formatWhen(iso: string) {
  // Fuso fixo (Luanda) para o servidor e o browser mostrarem a mesma hora
  return new Date(iso).toLocaleString("pt-PT", {
    timeZone: "Africa/Luanda",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusLabel = (v: string | null) =>
  (v && (statusLabels as Record<string, string>)[v]) || v || "—";

export function TicketTimeline({
  events,
  names,
}: {
  events: TimelineEvent[];
  names: Record<string, string>;
}) {
  // MESSAGE_SENT já aparece na conversa; RESOLVED/CLOSED duplicam o
  // STATUS_CHANGED correspondente
  const visible = events.filter((e) =>
    ["CREATED", "STATUS_CHANGED", "ASSIGNEE_CHANGED"].includes(e.type)
  );

  const who = (id: string | null) => (id ? names[id] || "Alguém da equipa" : "Sistema");

  function describe(e: TimelineEvent) {
    switch (e.type) {
      case "CREATED":
        return e.toValue
          ? `${who(e.actorId)} abriu o pedido em nome de ${who(e.toValue)}`
          : `${who(e.actorId)} abriu o pedido`;
      case "STATUS_CHANGED":
        return `${who(e.actorId)} alterou o estado: ${statusLabel(e.fromValue)} → ${statusLabel(e.toValue)}`;
      case "ASSIGNEE_CHANGED":
        if (!e.toValue) return `${who(e.actorId)} retirou a atribuição`;
        if (e.toValue === e.actorId) return `${who(e.actorId)} assumiu o pedido`;
        return `${who(e.actorId)} atribuiu o pedido a ${who(e.toValue)}`;
      default:
        return "";
    }
  }

  return (
    <details>
      <Summary>Histórico ({visible.length})</Summary>
      <List style={{ marginTop: 12 }}>
        {visible.map((e) => (
          <Item key={e.id}>
            <span>{describe(e)}</span>
            <MutedText>{formatWhen(e.createdAt)}</MutedText>
          </Item>
        ))}
      </List>
    </details>
  );
}