import { requirePermission } from "@/lib/auth/session";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SiteForm } from "@/components/admin/SiteForm";
import { createSite } from "../actions";

export default async function NewSitePage() {
  await requirePermission("admin:manage");

  return (
    <PageContainer $size="sm">
      <PageHeader title="Novo site" backHref="/admin/sites" />
      <SiteForm action={createSite} submitLabel="Criar site" />
    </PageContainer>
  );
}