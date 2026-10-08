"use client";

import Link from "next/link";
import styled from "styled-components";
import { Card } from "@/components/ui/Card";
import { StatusBadge, type TicketStatus } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Stack, Inline, MutedText } from "@/components/layout/Stack";

type TicketRow = {
  id: string;
  number: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
};

const Row = styled(Link)`
  display: block;
  text-decoration: none;
  color: inherit;
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.md};
  transition: background 0.15s;

  &:hover {
    background: ${({ theme }) => theme.colors.background};
  }

  & + & {
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  }
`;

const RowTop = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const priorityLabels: Record<string, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function TicketList({
  tickets,
  page,
  totalPages,
  basePath,
}: {
  tickets: TicketRow[];
  page: number;
  totalPages: number;
  basePath: string;
}) {
  if (tickets.length === 0) {
    return (
      <EmptyState
        title="Ainda não tens pedidos"
        description="Quando abrires um pedido de suporte, ele aparece aqui."
        action={
          <Link href="/tickets/new">
            <Button>Novo pedido</Button>
          </Link>
        }
      />
    );
  }

  return (
    <Stack $gap="md">
      <Card style={{ padding: 0 }}>
        {tickets.map((t) => (
          <Row key={t.id} href={`/tickets/${t.id}`}>
            <RowTop>
              <strong>{t.number}</strong>
              <StatusBadge status={t.status as TicketStatus} />
            </RowTop>
            <p style={{ margin: "4px 0" }}>{t.title}</p>
            <MutedText>
              {priorityLabels[t.priority] ?? t.priority} · {formatDate(t.created_at)}
            </MutedText>
          </Row>
        ))}
      </Card>

      {totalPages > 1 && (
        <Inline $gap="sm" style={{ justifyContent: "center" }}>
          {page > 1 && (
            <Link href={`${basePath}?page=${page - 1}`}>
              <Button $variant="secondary">Anterior</Button>
            </Link>
          )}
          <MutedText>
            Página {page} de {totalPages}
          </MutedText>
          {page < totalPages && (
            <Link href={`${basePath}?page=${page + 1}`}>
              <Button $variant="secondary">Seguinte</Button>
            </Link>
          )}
        </Inline>
      )}
    </Stack>
  );
}
