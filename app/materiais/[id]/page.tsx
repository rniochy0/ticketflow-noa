import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Stack, Inline, MutedText } from "@/components/layout/Stack";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ScrollArea, Table, Th, Td } from "@/components/ui/Table";
import { SupplyStatusBadge } from "@/components/supply/SupplyStatusBadge";
import { SupplyRequestActions } from "@/components/supply/SupplyRequestActions";
import { isSupplyStatus } from "@/lib/supply/labels";

type Line = {
  qty: number;
  supply_items: { name: string; ref: string | null; unit: string; stock_qty: number } | null;
};
type Guide = { id: string; number: string };
type Detail = {
  id: string;
  number: string;
  status: string;
  notes: string | null;
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
  delivered_at: string | null;
  requester_id: string;
  requester: { full_name: string } | null;
  stores: { name: string } | null;
  supply_request_items: Line[];
  delivery_guides: Guide | Guide[] | null;
};

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-PT", {
        timeZone: "Africa/Luanda",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

export default async function SupplyRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const user = await requireUser();
  const supabase = await createClient();

  // O RLS decide se este utilizador pode ver o pedido; senão, 404
  const { data } = await supabase
    .from("supply_requests")
    .select(
      `id, number, status, notes, decision_note, created_at, decided_at, delivered_at, requester_id,
       requester:profiles!supply_requests_requester_id_fkey(full_name),
       stores(name),
       supply_request_items(qty, supply_items(name, ref, unit, stock_qty)),
       delivery_guides(id, number)`
    )
    .eq("id", id)
    .single();

  const req = data as unknown as Detail | null;
  if (!req || !isSupplyStatus(req.status)) notFound();

  const status = req.status;
  const isAgent = can(user.role, "ticket:handle");
  const guide = Array.isArray(req.delivery_guides) ? req.delivery_guides[0] : req.delivery_guides;
  const lines = [...req.supply_request_items].sort((a, b) =>
    (a.supply_items?.name ?? "").localeCompare(b.supply_items?.name ?? "", "pt")
  );
  const stockIssue = lines.some((l) => l.supply_items && l.supply_items.stock_qty < l.qty);

  return (
    <PageContainer $size="md">
      <PageHeader title={req.number} backHref="/materiais" />

      <Card style={{ padding: 16 }}>
        <Stack $gap="sm">
          <Inline $gap="sm">
            <SupplyStatusBadge status={status} />
            <MutedText>Criado em {fmt(req.created_at)}</MutedText>
          </Inline>
          <MutedText>
            {[req.requester?.full_name, req.stores?.name].filter(Boolean).join(" · ")}
          </MutedText>
          {req.notes && <p style={{ margin: 0, overflowWrap: "anywhere" }}>{req.notes}</p>}
          {req.decision_note && (
            <MutedText>Nota do IT: {req.decision_note}</MutedText>
          )}
          {req.decided_at && <MutedText>Decidido em {fmt(req.decided_at)}</MutedText>}
          {req.delivered_at && <MutedText>Entregue em {fmt(req.delivered_at)}</MutedText>}
        </Stack>
      </Card>

      <ScrollArea>
        <Table>
          <thead>
            <tr>
              <Th>Artigo</Th>
              <Th>Referência</Th>
              <Th>Qtd</Th>
              {isAgent && (status === "PENDING" || status === "APPROVED") && <Th>Em stock</Th>}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <Td>{l.supply_items?.name ?? "—"}</Td>
                <Td>{l.supply_items?.ref ?? "—"}</Td>
                <Td>
                  {l.qty} {l.supply_items?.unit}
                </Td>
                {isAgent && (status === "PENDING" || status === "APPROVED") && (
                  <Td
                    style={
                      l.supply_items && l.supply_items.stock_qty < l.qty
                        ? { color: "#b91c1c", fontWeight: 600 }
                        : undefined
                    }
                  >
                    {l.supply_items?.stock_qty ?? "—"}
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      </ScrollArea>

      {guide && (
        <Card style={{ padding: 16 }}>
          <Inline $gap="md" style={{ justifyContent: "space-between" }}>
            <span>
              Guia de entrega <strong>{guide.number}</strong>
            </span>
            <Link href={`/api/materiais/guias/${guide.id}`} target="_blank" rel="noopener">
              <Button $variant="secondary">Abrir guia (PDF)</Button>
            </Link>
          </Inline>
        </Card>
      )}

      <SupplyRequestActions
        requestId={req.id}
        canDecide={isAgent && status === "PENDING" && req.requester_id !== user.id}
        canDeliver={isAgent && (status === "PENDING" || status === "APPROVED") && req.requester_id !== user.id}
        ownRequest={req.requester_id === user.id && isAgent && (status === "PENDING" || status === "APPROVED")}
        canCancel={req.requester_id === user.id && status === "PENDING"}
        defaultReceiver={req.requester?.full_name ?? ""}
        stockIssue={stockIssue}
      />
    </PageContainer>
  );
}
