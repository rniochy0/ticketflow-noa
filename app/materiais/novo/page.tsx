import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { NewSupplyRequestForm, type CatalogItem } from "@/components/supply/NewSupplyRequestForm";

export default async function NewSupplyRequestPage() {
  await requirePermission("ticket:create");
  const supabase = await createClient();

  // o RLS só devolve artigos activos a quem não é equipa
  const { data } = await supabase
    .from("supply_items")
    .select("id, name, ref, kind, unit, stock_qty")
    .eq("is_active", true)
    .order("name");

  return (
    <PageContainer $size="md">
      <PageHeader title="Novo pedido de material" backHref="/materiais" />
      <NewSupplyRequestForm items={(data ?? []) as CatalogItem[]} />
    </PageContainer>
  );
}
