import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { userIdSchema } from "@/lib/validation/user";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { UserForm } from "@/components/admin/UserForm";
import { updateUser } from "../../actions";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("admin:manage");
  const { id } = await params;
  if (!userIdSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const [{ data: user }, { data: sites }, { data: departments }] = await Promise.all([
    supabase
      .from("profiles")
      .select("email, full_name, role, store_id, department_id, job_title")
      .eq("id", id)
      .single(),
    // Inclui inativos para o site atual do utilizador continuar visível
    supabase.from("stores").select("id, name").order("name"),
    supabase.from("departments").select("id, name").order("name"),
  ]);
  if (!user) notFound();

  return (
    <PageContainer $size="sm">
      <PageHeader title="Editar utilizador" backHref="/admin/users" />
      <UserForm
        mode="edit"
        action={updateUser.bind(null, id)}
        initialValues={{
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          storeId: user.store_id ?? "",
          departmentId: user.department_id ?? "",
          jobTitle: user.job_title ?? "",
        }}
        sites={(sites ?? []).map((s) => ({ value: s.id, label: s.name }))}
        departments={(departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
      />
    </PageContainer>
  );
}