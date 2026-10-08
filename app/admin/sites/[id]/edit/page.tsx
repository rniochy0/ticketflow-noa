import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SiteForm } from "@/components/admin/SiteForm";
import { updateSite, type SiteFormState } from "../../actions";

export default async function EditSitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("admin:manage");
  const { id } = await params;
  const supabase = await createClient();

  const { data: site } = await supabase
    .from("stores")
    .select("id, code, name, type")
    .eq("id", id)
    .single();

  if (!site) notFound();

  // useActionState precisa de uma função (state, formData) => state;
  // "presa" ao id do site através de bind, sem o expor num input escondido
  // (um input escondido poderia ser adulterado no DevTools antes do submit)
  const boundUpdate = updateSite.bind(null, site.id) as (
    state: SiteFormState,
    formData: FormData
  ) => Promise<SiteFormState>;

  return (
    <PageContainer $size="sm">
      <PageHeader title={`Editar site — ${site.name}`} backHref="/admin/sites" />
      <SiteForm
        action={boundUpdate}
        initialValues={{ code: site.code, name: site.name, type: site.type }}
        submitLabel="Guardar alterações"
      />
    </PageContainer>
  );
}