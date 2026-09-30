import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { TicketList } from "@/components/tickets/TicketList";

const PAGE_SIZE = 20;

export default async function MyTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  // RLS já restringe a linhas do próprio utilizador (ou todas, se for staff);
  // o .eq aqui é só para "Meus pedidos" ser sempre só os meus, mesmo p/ staff
  const { data: tickets, count } = await supabase
    .from("tickets")
    .select("id, number, title, status, priority, created_at", { count: "exact" })
    .eq("requester_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageContainer $size="lg">
      <PageHeader title="Meus pedidos" backHref="/" />
      <TicketList
        tickets={tickets ?? []}
        page={page}
        totalPages={totalPages}
        basePath="/tickets"
      />
    </PageContainer>
  );
}
