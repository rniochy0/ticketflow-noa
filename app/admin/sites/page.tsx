import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Stack } from "@/components/layout/Stack";
import { Button } from "@/components/ui/Button";
import { SitesTable } from "@/components/admin/SitesTable";

export default async function SitesPage() {
  await requirePermission("admin:manage");
  const supabase = await createClient();

  // Sem .eq("is_active", true): o admin gere TODOS, incluindo os desactivados
  const { data: sites } = await supabase
    .from("stores")
    .select("id, code, name, type, is_active")
    .order("type")
    .order("name");

  return (
    <PageContainer $size="lg">
      <PageHeader title="Sites" backHref="/admin" />
      <Stack $gap="md">
        <Link href="/admin/sites/new">
          <Button>Novo site</Button>
        </Link>
        <SitesTable sites={sites ?? []} />
      </Stack>
    </PageContainer>
  );
}