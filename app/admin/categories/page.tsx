import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { CategoryManager, type CategoryRow } from "@/components/admin/CategoryManager";

export default async function CategoriesPage() {
  await requirePermission("admin:manage");
  const supabase = await createClient();

  // O admin vê TODAS (incluindo inactivas)
  const [{ data: cats }, { data: subs }] = await Promise.all([
    supabase.from("categories").select("id, name, is_active").order("name"),
    supabase.from("subcategories").select("id, name, is_active, category_id").order("name"),
  ]);

  const rows: CategoryRow[] = (cats ?? []).map((c) => ({
    ...c,
    subs: (subs ?? [])
      .filter((s) => s.category_id === c.id)
      .map(({ id, name, is_active }) => ({ id, name, is_active })),
  }));

  return (
    <PageContainer $size="md">
      <PageHeader title="Categorias" backHref="/admin" />
      <CategoryManager categories={rows} />
    </PageContainer>
  );
}