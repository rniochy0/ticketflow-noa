"use client";

import styled from "styled-components";

export type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_USER"
  | "RESOLVED"
  | "CLOSED";

const labels: Record<TicketStatus, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em atendimento",
  WAITING_USER: "Aguarda resposta",
  RESOLVED: "Resolvido",
  CLOSED: "Fechado",
};

const Pill = styled.span<{ $status: TicketStatus }>`
  display: inline-block;
  padding: 2px ${({ theme }) => theme.spacing.sm};
  border-radius: 999px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 600;
  white-space: nowrap;
  color: ${({ theme, $status }) => theme.colors.status[$status].fg};
  background: ${({ theme, $status }) => theme.colors.status[$status].bg};
`;

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <Pill $status={status}>{labels[status]}</Pill>;
}