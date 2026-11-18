import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Inline } from "@/components/layout/Stack";
import { Button } from "@/components/ui/Button";
import { SupplyRequestList, type SupplyRow } from "@/components/supply/SupplyRequestList";
import { isSupplyStatus } from "@/lib/supply/labels";

export default async function MySupplyRequestsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  // RLS já limita; o .eq mantém "os meus" também para a equipa
  const { data } = await supabase
    .from("supply_requests")
    .select("id, number, status, created_at")
    .eq("requester_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows: SupplyRow[] = (data ?? []).filter((r) => isSupplyStatus(r.status)) as SupplyRow[];
  const isAgent = can(user.role, "ticket:handle");

  return (
    <PageContainer $size="lg">
      <PageHeader title="Pedidos de material" backHref="/" />
      <Inline $gap="sm">
        <Link href="/materiais/novo">
          <Button>Novo pedido de material</Button>
        </Link>
        {isAgent && (
          <>
            <Link href="/materiais/gestao">
              <Button $variant="secondary">Gestão de pedidos</Button>
            </Link>
            <Link href="/materiais/stock">
              <Button $variant="secondary">Stock</Button>
            </Link>
          </>
        )}
      </Inline>
      <SupplyRequestList
        rows={rows}
        emptyTitle="Ainda não pediste material"
        emptyDescription="Toner, ratos, teclados, monitores... pede aqui."
      />
    </PageContainer>
  );
}
