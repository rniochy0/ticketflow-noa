import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  parseMyTicketsFilters,
  filtersToQuery,
  hasActiveFilters,
  dayStartIso,
  nextDayStartIso,
} from "@/lib/tickets/my-filters";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Stack, MutedText } from "@/components/layout/Stack";
import { MyTicketsFilterBar } from "@/components/tickets/MyTicketsFilterBar";
import { TicketList } from "@/components/tickets/TicketList";

const PAGE_SIZE = 20;

export default async function MyTicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters = parseMyTicketsFilters(sp);
  const rawPage = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.min(1000, Math.max(1, Number(rawPage) || 1));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  // RLS já restringe às linhas permitidas; o .eq garante que "Meus pedidos"
  // são sempre só os meus, mesmo para staff.
  let query = supabase
    .from("tickets")
    .select("id, number, title, status, priority, created_at", { count: "exact" })
    .eq("requester_id", user.id)
    .order("created_at", { ascending: filters.sort === "oldest" })
    .range(from, to);

  // q já passou por sanitizeSearch (sem , ( ) * % : que injectariam condições)
  if (filters.q) query = query.or(`title.ilike.%${filters.q}%,number.ilike.%${filters.q}%`);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.from) query = query.gte("created_at", dayStartIso(filters.from));
  if (filters.to) query = query.lt("created_at", nextDayStartIso(filters.to));

  const { data: tickets, count } = await query;

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const active = hasActiveFilters(filters);

  return (
    <PageContainer $size="lg">
      <PageHeader title="Meus pedidos" backHref="/" />
      <MyTicketsFilterBar current={filters} active={active} />
      <Stack $gap="sm">
        {active && <MutedText>{total} pedido(s) encontrado(s)</MutedText>}
        <TicketList
          tickets={tickets ?? []}
          page={page}
          totalPages={totalPages}
          basePath="/tickets"
          query={filtersToQuery(filters)}
          filtered={active}
        />
      </Stack>
    </PageContainer>
  );
}