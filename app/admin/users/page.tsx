import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSearch } from "@/lib/validation/search";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Stack, Inline, MutedText } from "@/components/layout/Stack";
import { Button } from "@/components/ui/Button";
import { UsersTable, type UserRow } from "@/components/admin/UsersTable";
import type { Role } from "@/lib/auth/roles";

const PAGE_SIZE = 25;

type RawRow = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  stores: { name: string } | null;
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const me = await requirePermission("admin:manage");
  const sp = await searchParams;
  const q = sanitizeSearch(sp.q);
  const page = Math.max(1, Math.min(10000, parseInt(sp.page ?? "1", 10) || 1));
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active, stores(name)", { count: "exact" })
    .order("full_name")
    .range(from, from + PAGE_SIZE - 1);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);

  const { data, count } = await query;
  const users: UserRow[] = ((data ?? []) as unknown as RawRow[]).map((u) => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    role: u.role,
    is_active: u.is_active,
    siteName: u.stores?.name ?? "—",
  }));

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const href = (p: number) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <PageContainer $size="lg">
      <PageHeader title="Utilizadores" backHref="/admin" />
      <Stack $gap="md">
        <Inline $gap="sm">
          <Link href="/admin/users/new">
            <Button>Novo utilizador</Button>
          </Link>
          <form action="/admin/users" method="get">
            <Inline $gap="xs">
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Pesquisar nome ou email"
                maxLength={80}
                style={{ padding: "8px 10px" }}
              />
              <Button type="submit" $variant="secondary">Pesquisar</Button>
            </Inline>
          </form>
        </Inline>

        <UsersTable users={users} currentUserId={me.id} />

        <Inline $gap="sm">
          {page > 1 && <Link href={href(page - 1)}>← Anterior</Link>}
          <MutedText>Página {page} de {totalPages} · {count ?? 0} utilizadores</MutedText>
          {page < totalPages && <Link href={href(page + 1)}>Seguinte →</Link>}
        </Inline>
      </Stack>
    </PageContainer>
  );
}