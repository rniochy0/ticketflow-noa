import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Stack, Inline, MutedText } from "@/components/layout/Stack";
import { Button } from "@/components/ui/Button";
import { TicketsFilterBar } from "@/components/tickets/TicketsFilterBar";
import { TicketsTable, type TicketTableRow } from "@/components/tickets/TicketsTable";
import Link from "next/link";

const PAGE_SIZE = 25;

// UUID simples, só para não deixar um filtro adulterado (?storeId=' OR 1=1)
// chegar sequer ao .eq() — o supabase-js já parametriza tudo, isto é defesa extra.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_VALUES = ["OPEN", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED"];
const PRIORITY_VALUES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

type SearchParams = {
  q?: string;
  status?: string;
  storeId?: string;
  categoryId?: string;
  priority?: string;
  page?: string;
};

type RawTicketRow = {
  id: string;
  number: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  stores: { name: string } | null;
  categories: { name: string } | null;
  requester: { full_name: string } | null;
  assignee: { full_name: string } | null;
};

export default async function AllTicketsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermission("ticket:view_all");
  const sp = await searchParams;

  const q = (sp.q ?? "").trim().slice(0, 100);
  const status = STATUS_VALUES.includes(sp.status ?? "") ? sp.status : undefined;
  const priority = PRIORITY_VALUES.includes(sp.priority ?? "") ? sp.priority : undefined;
  const storeId = UUID_RE.test(sp.storeId ?? "") ? sp.storeId : undefined;
  const categoryId = UUID_RE.test(sp.categoryId ?? "") ? sp.categoryId : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  const [{ data: stores }, { data: categories }] = await Promise.all([
    supabase.from("stores").select("id, name").eq("is_active", true).order("name"),
    supabase.from("categories").select("id, name").eq("is_active", true).order("name"),
  ]);

  let query = supabase
    .from("tickets")
    .select(
      `id, number, title, status, priority, created_at,
       stores(name), categories(name),
       requester:profiles!tickets_requester_id_fkey(full_name),
       assignee:profiles!tickets_assignee_id_fkey(full_name)`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  // .ilike com % literais controlados pelo código, nunca concatenação de SQL:
  // o valor do utilizador vai só como parâmetro do método, nunca para dentro de uma string SQL
  if (q) query = query.or(`title.ilike.%${q}%,number.ilike.%${q}%`);
  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (storeId) query = query.eq("store_id", storeId);
  if (categoryId) query = query.eq("category_id", categoryId);

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as RawTicketRow[];

  const tickets: TicketTableRow[] = rows.map((t) => ({
    id: t.id,
    number: t.number,
    title: t.title,
    status: t.status,
    priority: t.priority,
    created_at: t.created_at,
    storeName: t.stores?.name ?? "—",
    categoryName: t.categories?.name ?? "—",
    requesterName: t.requester?.full_name || "—",
    assigneeName: t.assignee?.full_name || null,
  }));

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const storeOptions = (stores ?? []).map((s) => ({ value: s.id, label: s.name }));
  const categoryOptions = (categories ?? []).map((c) => ({ value: c.id, label: c.name }));

  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (status) qs.set("status", status);
  if (priority) qs.set("priority", priority);
  if (storeId) qs.set("storeId", storeId);
  if (categoryId) qs.set("categoryId", categoryId);

  return (
    <PageContainer $size="lg">
      <PageHeader title="Todos os tickets" backHref="/it" />

      <TicketsFilterBar
        stores={storeOptions}
        categories={categoryOptions}
        current={{ q, status, storeId, categoryId, priority }} 
      />

      <Stack $gap="sm">

        <MutedText>{total ? "pedido encontrado": "pedidos encontrados" }</MutedText>

        <MutedText>  {total === 0 
          ? 'Nenhum pedido encontrado' 
          : `${total} ${total === 1 ? 'pedido encontrado' : 'pedidos encontrados'}`
         }</MutedText>
        <TicketsTable tickets={tickets} />

        {totalPages > 1 && (
          <Inline $gap="sm" style={{ justifyContent: "center" }}>
            {page > 1 && (
              <Link href={`/it/tickets?${qs.toString()}&page=${page - 1}`}>
                <Button $variant="secondary">Anterior</Button>
              </Link>
            )}
            <MutedText>
              Página {page} de {totalPages}
            </MutedText>
            {page < totalPages && (
              <Link href={`/it/tickets?${qs.toString()}&page=${page + 1}`}>
                <Button $variant="secondary">Seguinte</Button>
              </Link>
            )}
          </Inline>
        )}
      </Stack>
    </PageContainer>
  );
}