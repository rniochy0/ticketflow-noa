"use client";

import styled from "styled-components";
import { StatusBadge, type TicketStatus } from "@/components/ui/Badge";

// Cabeçalho "numero + badge de estado" repete-se em toda a UI de tickets
// (detalhe, listagem, central do IT) — vive aqui uma única vez
const Row = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Number = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.lg};
`;

export function TicketHeader({
  number,
  status,
}: {
  number: string;
  status: TicketStatus;
}) {
  return (
    <Row>
      <Number>{number}</Number>
      <StatusBadge status={status} />
    </Row>
  );
}