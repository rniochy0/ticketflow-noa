import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Stack, Inline, MutedText } from "@/components/layout/Stack";
import { Button } from "@/components/ui/Button";

export default async function AdminHome() {
  const user = await requirePermission("admin:manage");

  return (
    <PageContainer $size="lg">
      <PageHeader title="Administracão" backHref="/" />
      <Stack $gap="md">
        <MutedText>
          {user.fullName || user.email} ({user.role})
        </MutedText>
        <Inline $gap="sm">
          <Link href="/admin/sites">
            <Button $variant="secondary">Sites</Button>
          </Link>
          <Link href="/admin/users">
            <Button $variant="secondary">Utilizadores</Button>
          </Link>
          <Link href="/admin/categories">
            <Button $variant="secondary">Categorias</Button>
          </Link>
          <Link href="/admin/email-test">
            <Button $variant="secondary">Teste de email</Button>
          </Link>
        </Inline>
      </Stack>
    </PageContainer>
  );
}