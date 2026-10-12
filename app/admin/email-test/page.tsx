import { requirePermission } from "@/lib/auth/session";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Stack, MutedText } from "@/components/layout/Stack";
import { EMAIL_FROM } from "@/lib/email/client";
import { EmailTestForm } from "./EmailTestForm";

export default async function EmailTestPage() {
  const user = await requirePermission("admin:manage");
  return (
    <PageContainer $size="md">
      <PageHeader title="Teste de email" backHref="/admin" />
      <Stack $gap="md">
        <MutedText>Remetente: {EMAIL_FROM}</MutedText>
        <MutedText>Destino: {user.email}</MutedText>
        <EmailTestForm />
      </Stack>
    </PageContainer>
  );
}