import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { NewTicketForm } from "@/components/tickets/NewTicketForm";

export default async function NewTicketPage() {
  const user = await requirePermission("ticket:create");
  const supabase = await createClient();

  const isAgent = can(user.role, "ticket:handle");
  const [{ data: categories }, { data: subcategories }, { data: people }] = await Promise.all([
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
    // Só o IT precisa da lista (o RLS também só a devolve a quem é staff)
    isAgent
      ? supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("is_active", true)
          .order("full_name")
      : Promise.resolve({ data: null }),
  ]);

  return (
    <PageContainer $size="sm">
      <PageHeader title="Novo pedido" backHref="/" />
      <NewTicketForm
        categories={categories ?? []}
        subcategories={subcategories ?? []}
        requesters={
          isAgent
            ? (people ?? [])
                .filter((p) => p.id !== user.id)
                .map((p) => ({ value: p.id, label: `${p.full_name || p.email} (${p.email})` }))
            : undefined
        }
      />
    </PageContainer>
  );
}