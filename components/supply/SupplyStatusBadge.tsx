"use client";

import styled from "styled-components";
import { supplyStatusLabels, type SupplyStatus } from "@/lib/supply/labels";

// Reaproveita as cores dos estados dos tickets (theme.colors.status)
const colorKey = {
  PENDING: "WAITING_USER",
  APPROVED: "IN_PROGRESS",
  DELIVERED: "RESOLVED",
  REJECTED: "CLOSED",
  CANCELLED: "CLOSED",
} as const;

const Pill = styled.span<{ $key: (typeof colorKey)[SupplyStatus] }>`
  display: inline-block;
  padding: 2px ${({ theme }) => theme.spacing.sm};
  border-radius: 999px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 600;
  white-space: nowrap;
  color: ${({ theme, $key }) => theme.colors.status[$key].fg};
  background: ${({ theme, $key }) => theme.colors.status[$key].bg};
`;

export function SupplyStatusBadge({ status }: { status: SupplyStatus }) {
  return <Pill $key={colorKey[status]}>{supplyStatusLabels[status]}</Pill>;
}
