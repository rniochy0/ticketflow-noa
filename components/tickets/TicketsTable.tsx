"use client";

import Link from "next/link";
import styled from "styled-components";
import { StatusBadge, type TicketStatus } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

const ScrollArea = styled.div`
  overflow-x: auto;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  white-space: nowrap;
`;

const Th = styled.th`
  text-align: left;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.background};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  font-weight: 600;
`;

const Td = styled.td`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const RowLink = styled(Link)`
  color: inherit;
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
`;

const priorityLabels: Record<string, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export type TicketTableRow = {
  id: string;
  number: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  storeName: string;
  categoryName: string;
  requesterName: string;
  assigneeName: string | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function TicketsTable({ tickets }: { tickets: TicketTableRow[] }) {
  if (tickets.length === 0) {
    return <EmptyState title="Nenhum ticket encontrado" description="Ajusta os filtros e tenta de novo." />;
  }

  return (
    <ScrollArea>
      <Table>
        <thead>
          <tr>
            <Th>Nº</Th>
            <Th>Título</Th>
            <Th>Solicitante</Th>
            <Th>Loja</Th>
            <Th>Categoria</Th>
            <Th>Prioridade</Th>
            <Th>Estado</Th>
            <Th>Responsável</Th>
            <Th>Data</Th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id}>
              <Td>
                <RowLink href={`/tickets/${t.id}`}>{t.number}</RowLink>
              </Td>
              <Td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>
                {t.title}
              </Td>
              <Td>{t.requesterName}</Td>
              <Td>{t.storeName}</Td>
              <Td>{t.categoryName}</Td>
              <Td>{priorityLabels[t.priority] ?? t.priority}</Td>
              <Td>
                <StatusBadge status={t.status as TicketStatus} />
              </Td>
              <Td>{t.assigneeName ?? "—"}</Td>
              <Td>{formatDate(t.created_at)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </ScrollArea>
  );
}