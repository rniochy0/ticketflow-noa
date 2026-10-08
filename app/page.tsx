import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { Button } from "@/components/ui/Button";
import { PageContainer, PageTitle } from "@/components/layout/PageContainer";
import { Stack, Inline, MutedText } from "@/components/layout/Stack";
import { logout } from "./login/actions";

export default async function Home() {
  const user = await requireUser();

  return (
    <PageContainer $size="sm">
      <PageTitle>NOA HelpDesk</PageTitle>
      <Stack $gap="xs">
        <p style={{ margin: 0 }}>Ola, {user.fullName || user.email}</p>
        <MutedText>Perfil: {user.role}</MutedText>
      </Stack>

      <Inline as="nav" $gap="md">
        {can(user.role, "ticket:create") && <Link href="/tickets/new">Novo pedido</Link>}
        {can(user.role, "ticket:create") && <Link href="/tickets">Meus pedidos</Link>}
        {can(user.role, "ticket:view_all") && <Link href="/it">Central do IT</Link>}
        {can(user.role, "dashboard:view") && <Link href="/dashboard">Dashboard</Link>}
        {can(user.role, "admin:manage") && <Link href="/admin">Administracao</Link>}
      </Inline>

      <form action={logout}>
        <Button type="submit" $variant="secondary">
          Sair
        </Button>
      </form>
    </PageContainer>
  );
}