import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { StockManager, type StockItem } from "@/components/supply/StockManager";

export default async function SupplyStockPage() {
  const user = await requirePermission("ticket:handle");
  const supabase = await createClient();

  const { data } = await supabase
    .from("supply_items")
    .select("id, name, ref, kind, unit, stock_qty, min_stock, is_active")
    .order("name");

  return (
    <PageContainer $size="lg">
      <PageHeader title="Stock de material" backHref="/materiais" />
      <StockManager items={(data ?? []) as StockItem[]} canEdit={can(user.role, "admin:manage")} />
    </PageContainer>
  );
}
