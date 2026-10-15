"use client";

import Link from "next/link";
import styled from "styled-components";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { MyTicketsFilters } from "@/lib/tickets/my-filters";

const Bar = styled.form`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  align-items: end;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
`;

const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
`;

const statusOptions = [
  { value: "OPEN", label: "Aberto" },
  { value: "IN_PROGRESS", label: "Em atendimento" },
  { value: "WAITING_USER", label: "Aguarda resposta" },
  { value: "RESOLVED", label: "Resolvido" },
  { value: "CLOSED", label: "Fechado" },
];

const sortOptions = [
  { value: "newest", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
];

export function MyTicketsFilterBar({
  current,
  active,
}: {
  current: MyTicketsFilters;
  active: boolean;
}) {
  return (
    // GET sem JavaScript: a URL é a única fonte de verdade dos filtros
    <Bar action="/tickets" method="get">
      <Input label="Pesquisar" name="q" defaultValue={current.q} placeholder="Número ou título" maxLength={80} />
      <FilterSelect name="status" label="Estado" options={statusOptions} defaultValue={current.status} />
      <Input label="De" name="from" type="date" defaultValue={current.from} />
      <Input label="Até" name="to" type="date" defaultValue={current.to} />
      <FilterSelect name="sort" label="Ordenar" options={sortOptions} defaultValue={current.sort} allLabel={null} />
      <Actions>
        <Button type="submit" $variant="secondary">Filtrar</Button>
        {active && <Link href="/tickets">Limpar</Link>}
      </Actions>
    </Bar>
  );
}