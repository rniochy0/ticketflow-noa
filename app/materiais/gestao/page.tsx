import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Inline } from "@/components/layout/Stack";
import { Button } from "@/components/ui/Button";
import { SupplyRequestList, type SupplyRow } from "@/components/supply/SupplyRequestList";
import { isSupplyStatus, supplyStatusLabels, type SupplyStatus } from "@/lib/supply/labels";

const TABS: { value: SupplyStatus | "ALL"; label: string }[] = [
  { value: "PENDING", label: "Por tratar" },
  { value: "APPROVED", label: "Aceites" },
  { value: "DELIVERED", label: supplyStatusLabels.DELIVERED + "s" },
  { value: "ALL", label: "Todos" },
];

type Raw = {
  id: string;
  number: string;
  status: string;
  created_at: string;
  requester: { full_name: string } | null;
  stores: { name: string } | null;
};

export default async function SupplyManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requirePermission("ticket:handle");
  const { status: raw } = await searchParams;
  const current: SupplyStatus | "ALL" = raw === "ALL" ? "ALL" : isSupplyStatus(raw) ? raw : "PENDING";

  const supabase = await createClient();
  let query = supabase
    .from("supply_requests")
    .select(
      "id, number, status, created_at, requester:profiles!supply_requests_requester_id_fkey(full_name), stores(name)"
    )
    .order("created_at", { ascending: current === "APPROVED" || current === "PENDING" })
    .limit(100);
  if (current !== "ALL") query = query.eq("status", current);

  const { data } = await query;
  const rows: SupplyRow[] = ((data ?? []) as unknown as Raw[])
    .filter((r) => isSupplyStatus(r.status))
    .map((r) => ({
      id: r.id,
      number: r.number,
      status: r.status as SupplyStatus,
      created_at: r.created_at,
      requesterName: r.requester?.full_name || undefined,
      storeName: r.stores?.name || undefined,
    }));

  return (
    <PageContainer $size="lg">
      <PageHeader title="Gestão de material" backHref="/materiais" />
      <Inline $gap="sm">
        {TABS.map((t) => (
          <Link key={t.value} href={`/materiais/gestao?status=${t.value}`}>
            <Button $variant={t.value === current ? "primary" : "secondary"}>{t.label}</Button>
          </Link>
        ))}
        <Link href="/materiais/stock">
          <Button $variant="secondary">Stock</Button>
        </Link>
      </Inline>
      <SupplyRequestList
        rows={rows}
        emptyTitle="Sem pedidos nesta lista"
        emptyDescription="Quando houver pedidos neste estado, aparecem aqui."
      />
    </PageContainer>
  );
}
