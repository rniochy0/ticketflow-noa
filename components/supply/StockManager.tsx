"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { ErrorBanner, SuccessBanner } from "@/components/ui/ErrorBanner";
import { ScrollArea, Table, Th, Td } from "@/components/ui/Table";
import { Stack, Inline, MutedText } from "@/components/layout/Stack";
import {
  createSupplyItem,
  updateSupplyItem,
  adjustSupplyStock,
  toggleSupplyItemActive,
  type StockFormState,
} from "@/app/materiais/stock/actions";
import { SUPPLY_KINDS, supplyKindLabels, type SupplyKind } from "@/lib/supply/labels";

export type StockItem = {
  id: string;
  name: string;
  ref: string | null;
  kind: SupplyKind;
  unit: string;
  stock_qty: number;
  min_stock: number;
  is_active: boolean;
};

const FormGrid = styled.form`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: end;
`;

const Low = styled.span`
  color: #b91c1c;
  font-weight: 700;
`;

const kindOptions = SUPPLY_KINDS.map((k) => ({ value: k, label: supplyKindLabels[k] }));

function Feedback({ state }: { state: StockFormState }) {
  if (state.error) return <ErrorBanner>{state.error}</ErrorBanner>;
  if (state.ok) return <SuccessBanner>Guardado.</SuccessBanner>;
  return null;
}

function CreateItemForm() {
  const [state, action, pending] = useActionState<StockFormState, FormData>(createSupplyItem, {});
  return (
    <Stack $gap="sm">
      <strong>Novo artigo</strong>
      <FormGrid action={action} noValidate>
        <Input label="Nome" name="name" maxLength={100} disabled={pending} />
        <Input label="Referência" name="ref" maxLength={50} disabled={pending} />
        <Select label="Tipo" name="kind" options={kindOptions} defaultValue="OUTRO" disabled={pending} />
        <Input label="Unidade" name="unit" defaultValue="un" maxLength={20} disabled={pending} />
        <Input label="Stock mínimo" name="minStock" type="number" min={0} defaultValue={0} disabled={pending} />
        <Button type="submit" disabled={pending}>
          {pending ? "A guardar..." : "Criar"}
        </Button>
      </FormGrid>
      <Feedback state={state} />
      <MutedText>O stock começa a 0: depois regista a entrada em "Ajustar stock".</MutedText>
    </Stack>
  );
}

function AdjustForm({ itemId }: { itemId: string }) {
  const [state, action, pending] = useActionState<StockFormState, FormData>(adjustSupplyStock, {});
  return (
    <Stack $gap="sm">
      <strong>Ajustar stock</strong>
      <FormGrid action={action} noValidate>
        <input type="hidden" name="itemId" value={itemId} />
        <Input label="Quantidade (+ entra, − sai)" name="delta" type="number" step={1} disabled={pending} />
        <Input label="Motivo" name="reason" maxLength={200} placeholder="Ex.: compra, contagem" disabled={pending} />
        <Button type="submit" disabled={pending}>
          {pending ? "A guardar..." : "Registar"}
        </Button>
      </FormGrid>
      <Feedback state={state} />
    </Stack>
  );
}

function EditForm({ item }: { item: StockItem }) {
  const [state, action, pending] = useActionState<StockFormState, FormData>(updateSupplyItem, {});
  return (
    <Stack $gap="sm">
      <strong>Editar artigo</strong>
      <FormGrid action={action} noValidate>
        <input type="hidden" name="id" value={item.id} />
        <Input label="Nome" name="name" defaultValue={item.name} maxLength={100} disabled={pending} />
        <Input label="Referência" name="ref" defaultValue={item.ref ?? ""} maxLength={50} disabled={pending} />
        <Select label="Tipo" name="kind" options={kindOptions} defaultValue={item.kind} disabled={pending} />
        <Input label="Unidade" name="unit" defaultValue={item.unit} maxLength={20} disabled={pending} />
        <Input label="Stock mínimo" name="minStock" type="number" min={0} defaultValue={item.min_stock} disabled={pending} />
        <Button type="submit" disabled={pending}>
          {pending ? "A guardar..." : "Guardar"}
        </Button>
      </FormGrid>
      <Feedback state={state} />
    </Stack>
  );
}

function ItemRow({ item, canEdit }: { item: StockItem; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const low = item.stock_qty <= item.min_stock;

  function toggle() {
    setError(null);
    startTransition(async () => {
      try {
        const r = await toggleSupplyItemActive(item.id, !item.is_active);
        if (r.error) setError(r.error);
        else router.refresh();
      } catch {
        setError("Sem ligação ao servidor.");
      }
    });
  }

  return (
    <>
      <tr style={item.is_active ? undefined : { opacity: 0.55 }}>
        <Td>{item.name}</Td>
        <Td>{item.ref ?? "—"}</Td>
        <Td>{supplyKindLabels[item.kind]}</Td>
        <Td>
          {low ? <Low>{item.stock_qty}</Low> : item.stock_qty} {item.unit}
        </Td>
        <Td>{item.min_stock}</Td>
        <Td>{item.is_active ? "Ativo" : "Inativo"}</Td>
        <Td>
          <Inline $gap="xs">
            <Button type="button" $variant="secondary" onClick={() => setOpen((o) => !o)}>
              {open ? "Fechar" : "Gerir"}
            </Button>
            {canEdit && (
              <Button type="button" $variant="secondary" disabled={pending} onClick={toggle}>
                {item.is_active ? "Desativar" : "Ativar"}
              </Button>
            )}
          </Inline>
          {error && <MutedText>{error}</MutedText>}
        </Td>
      </tr>
      {open && (
        <tr>
          <Td colSpan={7} style={{ whiteSpace: "normal" }}>
            <Stack $gap="lg">
              <AdjustForm itemId={item.id} />
              {canEdit && <EditForm item={item} />}
            </Stack>
          </Td>
        </tr>
      )}
    </>
  );
}

export function StockManager({ items, canEdit }: { items: StockItem[]; canEdit: boolean }) {
  return (
    <Stack $gap="lg">
      {canEdit && (
        <Card style={{ padding: 16 }}>
          <CreateItemForm />
        </Card>
      )}
      <ScrollArea>
        <Table>
          <thead>
            <tr>
              <Th>Artigo</Th>
              <Th>Referência</Th>
              <Th>Tipo</Th>
              <Th>Stock</Th>
              <Th>Mínimo</Th>
              <Th>Estado</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <Td colSpan={7}>Ainda não há artigos no catálogo.</Td>
              </tr>
            ) : (
              items.map((i) => <ItemRow key={i.id} item={i} canEdit={canEdit} />)
            )}
          </tbody>
        </Table>
      </ScrollArea>
      <MutedText>Stock a vermelho = igual ou abaixo do mínimo definido.</MutedText>
    </Stack>
  );
}
