import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parsePeriod, periodStart, periodLabels } from "@/lib/dashboard/period";
import { statusPluralLabels } from "@/lib/tickets/labels";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Stack, CardGrid, MutedText } from "@/components/layout/Stack";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PeriodTabs } from "@/components/dashboard/PeriodTabs";
import { BarList } from "@/components/dashboard/BarList";
import type { TicketStatus } from "@/components/ui/Badge";

type Stats = {
  total: number;
  by_status: Partial<Record<TicketStatus, number>>;
  by_category: { name: string; count: number }[];
  by_site: { name: string; count: number }[];
};

const STATUS_ORDER: TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_USER",
  "RESOLVED",
  "CLOSED",
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  // Camada 1: RBAC. (Camada 2: guard dentro da função SQL. Camada 3: RLS.)
  await requirePermission("dashboard:view");

  // O período vem da URL: só aceitamos valores da lista, o resto cai no padrão.
  const { period: rawPeriod } = await searchParams;
  const period = parsePeriod(rawPeriod);
  const since = periodStart(period);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_stats", {
    p_since: since.toISOString(),
  });

  const stats = data as Stats | null;

  return (
    <PageContainer $size="lg">
      <PageHeader title="Dashboard" backHref="/" />
      <PeriodTabs current={period} />

      {error || !stats ? (
        // Mensagem genérica de propósito: não expomos o erro da BD ao utilizador
        <EmptyState
          title="Não foi possível carregar os indicadores"
          description="Tenta novamente dentro de instantes."
        />
      ) : stats.total === 0 ? (
        <EmptyState
          title="Sem pedidos neste período"
          description={`Ainda não foram criados pedidos (${periodLabels[period].toLowerCase()}).`}
        />
      ) : (
        <Stack $gap="lg">
          <MutedText>
            Pedidos criados no período, agrupados pelo estado em que estão agora.
          </MutedText>

          <CardGrid>
            <StatCard label="Total" value={stats.total} />
            {STATUS_ORDER.map((s) => (
              <StatCard
                key={s}
                label={statusPluralLabels[s]}
                value={stats.by_status[s] ?? 0}
              />
            ))}
          </CardGrid>

          <CardGrid style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <Card>
              <Stack $gap="md">
                <h2 style={{ margin: 0, fontSize: 16 }}>Por categoria</h2>
                <BarList items={stats.by_category} />
              </Stack>
            </Card>
            <Card>
              <Stack $gap="md">
                <h2 style={{ margin: 0, fontSize: 16 }}>Por site</h2>
                <BarList items={stats.by_site} />
              </Stack>
            </Card>
          </CardGrid>
        </Stack>
      )}
    </PageContainer>
  );
}