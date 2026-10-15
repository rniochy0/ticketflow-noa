import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { statusPluralLabels } from "@/lib/tickets/labels";
import { STATUS_VALUES } from "@/lib/tickets/my-filters";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { NavCard } from "@/components/ui/NavCard";
import { PageContainer, PageTitle } from "@/components/layout/PageContainer";
import { Stack, Inline, CardGrid, MutedText } from "@/components/layout/Stack";
import { TicketList } from "@/components/tickets/TicketList";
import { logout } from "./login/actions";

export default async function Home() {
  const user = await requireUser();
  const supabase = await createClient();
  const canCreate = can(user.role, "ticket:create");

  // Só os pedidos do próprio utilizador (o RLS já o garante; o .eq mantém a
  // home pessoal também para staff). Só lemos a coluna status para contar.
  const [{ data: statusRows }, { data: recent }] = canCreate
    ? await Promise.all([
        supabase.from("tickets").select("status").eq("requester_id", user.id).limit(2000),
        supabase
          .from("tickets")
          .select("id, number, title, status, priority, created_at")
          .eq("requester_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ])
    : [{ data: null }, { data: null }];

  const counts: Record<string, number> = {};
  for (const r of statusRows ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const total = statusRows?.length ?? 0;
  const waiting = counts.WAITING_USER ?? 0;

  return (
    <PageContainer $size="lg">
      <Inline $gap="md" style={{ justifyContent: "space-between" }}>
        <Stack $gap="xs">
          <PageTitle>Olá, {user.fullName || user.email}</PageTitle>
          <MutedText>NOA HelpDesk</MutedText>
        </Stack>
        <form action={logout}>
          <Button type="submit" $variant="secondary">
            Sair
          </Button>
        </form>
      </Inline>

      {canCreate && (
        <>
          {waiting > 0 && (
            <Card style={{ padding: 16 }}>
              <Stack $gap="xs">
                <strong>
                  {waiting === 1
                    ? "1 pedido aguarda a tua resposta"
                    : `${waiting} pedidos aguardam a tua resposta`}
                </strong>
                <Link href="/tickets?status=WAITING_USER">Ver pedidos</Link>
              </Stack>
            </Card>
          )}

          <CardGrid>
            {STATUS_VALUES.filter((s) => s !== "CLOSED").map((s) => (
              <StatCard
                key={s}
                label={statusPluralLabels[s]}
                value={counts[s] ?? 0}
                href={`/tickets?status=${s}`}
              />
            ))}
            <StatCard label="Total" value={total} href="/tickets" />
          </CardGrid>

          <Stack $gap="sm">
            <h2 style={{ margin: 0, fontSize: 16 }}>Pedidos recentes</h2>
            <TicketList tickets={recent ?? []} />
          </Stack>
        </>
      )}

      <CardGrid style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {canCreate && (
          <NavCard href="/tickets/new" title="Novo pedido" description="Pedir ajuda ao IT" />
        )}
        {canCreate && (
          <NavCard href="/tickets" title="Meus pedidos" description="Pesquisar e filtrar" />
        )}
        {can(user.role, "ticket:view_all") && (
          <NavCard href="/it" title="Central do IT" description="Atender pedidos" />
        )}
        {can(user.role, "dashboard:view") && (
          <NavCard href="/dashboard" title="Dashboard" description="Indicadores" />
        )}
        {can(user.role, "admin:manage") && (
          <NavCard href="/admin" title="Administração" description="Sites, utilizadores, categorias" />
        )}
        <NavCard href="/conta/password" title="Alterar password" />
      </CardGrid>
    </PageContainer>
  );
}