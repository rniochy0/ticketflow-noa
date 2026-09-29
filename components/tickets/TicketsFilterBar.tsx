"use client";

import styled from "styled-components";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const Bar = styled.form`
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
`;

const statusOptions = [
  { value: "OPEN", label: "Aberto" },
  { value: "IN_PROGRESS", label: "Em atendimento" },
  { value: "WAITING_USER", label: "Aguarda resposta" },
  { value: "RESOLVED", label: "Resolvido" },
  { value: "CLOSED", label: "Fechado" },
];

const priorityOptions = [
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
];

type Option = { value: string; label: string };

export function TicketsFilterBar({
  stores,
  categories,
  current,
}: {
  stores: Option[];
  categories: Option[];
  current: {
    q?: string;
    status?: string;
    storeId?: string;
    categoryId?: string;
    priority?: string;
  };
}) {
  return (
    // method="get" para /it/tickets: sem JavaScript, sem estado no cliente —
    // os filtros são sempre a verdade da URL, e essa URL é partilhável
    <Bar action="/it/tickets" method="get">
      <div style={{ minWidth: 180 }}>
        <Input
          label="Pesquisar"
          name="q"
          defaultValue={current.q}
          placeholder="Número ou título"
        />
      </div>
      <FilterSelect name="status" label="Estado" options={statusOptions} defaultValue={current.status} />
      <FilterSelect name="storeId" label="Loja" options={stores} defaultValue={current.storeId} />
      <FilterSelect name="categoryId" label="Categoria" options={categories} defaultValue={current.categoryId} />
      <FilterSelect name="priority" label="Prioridade" options={priorityOptions} defaultValue={current.priority} />
      <Button type="submit" $variant="secondary">Filtrar</Button>
    </Bar>
  );
}
