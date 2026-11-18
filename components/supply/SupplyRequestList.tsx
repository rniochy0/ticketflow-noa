"use client";

import Link from "next/link";
import styled from "styled-components";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MutedText } from "@/components/layout/Stack";
import { SupplyStatusBadge } from "./SupplyStatusBadge";
import type { SupplyStatus } from "@/lib/supply/labels";

export type SupplyRow = {
  id: string;
  number: string;
  status: SupplyStatus;
  created_at: string;
  requesterName?: string;
  storeName?: string;
};

const Row = styled(Link)`
  display: block;
  text-decoration: none;
  color: inherit;
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.md};

  &:hover {
    background: ${({ theme }) => theme.colors.background};
  }
  & + & {
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  }
`;

const Top = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });

export function SupplyRequestList({
  rows,
  emptyTitle,
  emptyDescription,
}: {
  rows: SupplyRow[];
  emptyTitle: string;
  emptyDescription?: string;
}) {
  if (rows.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <Card style={{ padding: 0 }}>
      {rows.map((r) => (
        <Row key={r.id} href={`/materiais/${r.id}`}>
          <Top>
            <strong>{r.number}</strong>
            <SupplyStatusBadge status={r.status} />
          </Top>
          <MutedText>
            {[r.requesterName, r.storeName, fmt(r.created_at)].filter(Boolean).join(" · ")}
          </MutedText>
        </Row>
      ))}
    </Card>
  );
}
