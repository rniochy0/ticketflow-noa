import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { UserForm } from "@/components/admin/UserForm";
import { createUser } from "../actions";

export default async function NewUserPage() {
  await requirePermission("admin:manage");
  const supabase = await createClient();
  const [{ data: sites }, { data: departments }] = await Promise.all([
    supabase.from("stores").select("id, name").eq("is_active", true).order("name"),
    supabase.from("departments").select("id, name").eq("is_active", true).order("name"),
  ]);

  return (
    <PageContainer $size="sm">
      <PageHeader title="Novo utilizador" backHref="/admin/users" />
      <UserForm
        mode="create"
        action={createUser}
        sites={(sites ?? []).map((s) => ({ value: s.id, label: s.name }))}
        departments={(departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
      />
    </PageContainer>
  );
}