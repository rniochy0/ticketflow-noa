import { requireUser } from "@/lib/auth/session";
import { PageContainer, PageTitle } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import Link from "next/link";
import { Stack, MutedText } from "@/components/layout/Stack";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ obrigatorio?: string }>;
}) {
  await requireUser();
  const { obrigatorio } = await searchParams;
  const forced = obrigatorio === "1";

  return (
    <PageContainer $size="sm">
      {forced ? (
        <Stack $gap="xs">
          <PageTitle>Define a tua password</PageTitle>
          <MutedText>
            Estás a usar uma password temporária. Define uma nova para continuar.
          </MutedText>
        </Stack>
      ) : (
        <PageHeader title="Alterar password" backHref="/" />
      )}
      <ChangePasswordForm forced={forced} />
      {forced && <Link href="/auth/end-session">Sair</Link>}
    </PageContainer>
  );
}