"use client";

import { useActionState } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { FieldWrapper, FieldLabel, fieldControlCss } from "@/components/ui/Field";
import { MutedText } from "@/components/layout/Stack";
import { createSupplyRequest, type SupplyActionState } from "@/app/materiais/actions";
import { SUPPLY_KINDS, supplyKindLabels, type SupplyKind } from "@/lib/supply/labels";
import { MAX_QTY } from "@/lib/validation/supply";

export type CatalogItem = {
  id: string;
  name: string;
  ref: string | null;
  kind: SupplyKind;
  unit: string;
  stock_qty: number;
};

const Form = styled.form`
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
`;

const Group = styled.fieldset`
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;

  legend {
    padding: 0;
    margin-bottom: ${({ theme }) => theme.spacing.xs};
    font-weight: 600;
  }
`;

const ItemRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 96px;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: end;
`;

const TextArea = styled.textarea`
  ${fieldControlCss}
  min-height: 80px;
  padding: ${({ theme }) => theme.spacing.md};
  font: inherit;
  resize: vertical;
`;

export function NewSupplyRequestForm({ items }: { items: CatalogItem[] }) {
  const [state, formAction, pending] = useActionState<SupplyActionState, FormData>(
    createSupplyRequest,
    {}
  );

  if (items.length === 0) {
    return (
      <EmptyState
        title="O catálogo está vazio"
        description="Ainda não há artigos disponíveis para pedir. Fala com o IT."
      />
    );
  }

  const groups = SUPPLY_KINDS.map((kind) => ({
    kind,
    items: items.filter((i) => i.kind === kind),
  })).filter((g) => g.items.length > 0);

  return (
    <Card>
      <Form action={formAction} noValidate>
        {state.error && <ErrorBanner>{state.error}</ErrorBanner>}
        <MutedText>
          Indica a quantidade dos artigos de que precisas (deixa 0 nos restantes). O pedido segue
          para aprovação do gestor.
        </MutedText>

        {groups.map((g) => (
          <Group key={g.kind}>
            <legend>{supplyKindLabels[g.kind]}</legend>
            {g.items.map((i) => (
              <ItemRow key={i.id}>
                <span>
                  {i.name}
                  {i.ref ? <MutedText as="span"> ({i.ref})</MutedText> : null}
                </span>
                <Input
                  label={`Qtd (${i.unit})`}
                  name={`qty_${i.id}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_QTY}
                  step={1}
                  defaultValue={0}
                  disabled={pending}
                />
              </ItemRow>
            ))}
          </Group>
        ))}

        <FieldWrapper>
          <FieldLabel htmlFor="notes">Notas (opcional)</FieldLabel>
          <TextArea id="notes" name="notes" maxLength={500} disabled={pending} />
        </FieldWrapper>

        <Button type="submit" $fullWidth disabled={pending}>
          {pending ? "A enviar..." : "Enviar pedido"}
        </Button>
      </Form>
    </Card>
  );
}
