import { requireUser } from "@/lib/auth/session";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default async function PasswordPage() {
  await requireUser();
  return (
    <PageContainer $size="sm">
      <PageHeader title="Alterar password" backHref="/" />
      <ChangePasswordForm />
    </PageContainer>
  );
}