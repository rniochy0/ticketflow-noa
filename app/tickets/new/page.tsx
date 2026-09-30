import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { NewTicketForm } from "@/components/tickets/NewTicketForm";

export default async function NewTicketPage() {
  await requirePermission("ticket:create");
  const supabase = await createClient();

  const [{ data: categories }, { data: subcategories }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("subcategories")
      .select("id, name, category_id")
      .eq("is_active", true)
      .order("name"),
  ]);

  return (
    <PageContainer $size="sm">
      <PageHeader title="Novo pedido" backHref="/" />
      <NewTicketForm
        categories={categories ?? []}
        subcategories={subcategories ?? []}
      />
    </PageContainer>
  );
}