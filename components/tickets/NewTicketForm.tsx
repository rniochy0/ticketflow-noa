"use client";

import { useActionState, useMemo, useState } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { FieldWrapper, FieldLabel, FieldError, fieldControlCss } from "@/components/ui/Field";
import { createTicket, type CreateTicketState } from "@/app/tickets/actions";

const Form = styled.form`
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
`;

const TextArea = styled.textarea<{ $hasError?: boolean }>`
  ${fieldControlCss}
  min-height: 140px;
  padding: ${({ theme }) => theme.spacing.md};
  font: inherit;
  resize: vertical;
`;

const ErrorBanner = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.md};
  background: #fee2e2;
  color: ${({ theme }) => theme.colors.danger};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

const priorityOptions = [
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
];

type CategoryRow = { id: string; name: string };
type SubcategoryRow = { id: string; name: string; category_id: string };

export function NewTicketForm({
  categories,
  subcategories,
}: {
  categories: CategoryRow[];
  subcategories: SubcategoryRow[];
}) {
  const [state, formAction, pending] = useActionState<
    CreateTicketState,
    FormData
  >(createTicket, {});

  const [categoryId, setCategoryId] = useState("");

  const filteredSubcategories = useMemo(
    () => subcategories.filter((s) => s.category_id === categoryId),
    [subcategories, categoryId]
  );

  return (
    <Card>
      <Form action={formAction} noValidate>
        {state.error && <ErrorBanner role="alert">{state.error}</ErrorBanner>}

        <Input
          label="Título"
          name="title"
          defaultValue={state.values?.title}
          error={state.fieldErrors?.title}
          maxLength={150}
        />

        <FieldWrapper>
          <FieldLabel htmlFor="description">Descrição</FieldLabel>
          <TextArea
            id="description"
            name="description"
            defaultValue={state.values?.description}
            $hasError={!!state.fieldErrors?.description}
            maxLength={5000}
          />
          {state.fieldErrors?.description && (
            <FieldError role="alert">{state.fieldErrors.description}</FieldError>
          )}
        </FieldWrapper>

        <Select
          label="Categoria"
          name="categoryId"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          error={state.fieldErrors?.categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        />

        <Select
          label="Subcategoria (opcional)"
          name="subcategoryId"
          placeholder="Nenhuma"
          options={filteredSubcategories.map((s) => ({ value: s.id, label: s.name }))}
          disabled={!categoryId}
        />

        <Select
          label="Prioridade"
          name="priority"
          options={priorityOptions}
          defaultValue="MEDIUM"
          error={state.fieldErrors?.priority}
        />

        <Button type="submit" $fullWidth disabled={pending}>
          {pending ? "A enviar..." : "Enviar pedido"}
        </Button>
      </Form>
    </Card>
  );
}