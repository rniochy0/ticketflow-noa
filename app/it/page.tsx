import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { CardGrid } from "@/components/layout/Stack";
import { StatCard } from "@/components/ui/StatCard";
import { statusPluralLabels } from "@/lib/tickets/labels";
import { Button } from "@/components/ui/Button";

const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_USER", "RESOLVED"] as const;


export default async function ItHome() {
  await requirePermission("ticket:view_all");
  const supabase = await createClient();

  const countsPromise = Promise.all(
    STATUSES.map((status) =>
      supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", status)
    )
  );
  const totalPromise = supabase
    .from("tickets")
    .select("id", { count: "exact", head: true });

  const [counts, totalResult] = await Promise.all([countsPromise, totalPromise]);

  return (
    <PageContainer $size="lg">
      <PageHeader title="Central do IT" backHref="/" />

      <CardGrid>
        {STATUSES.map((status, i) => (
          <StatCard
            key={status}
            label={statusPluralLabels[status]}
            value={counts[i].count ?? 0}
          />
        ))}
        <StatCard label="Total" value={totalResult.count ?? 0} />
      </CardGrid>

      <Link href="/it/tickets">
        <Button>Ver todos os tickets</Button>
      </Link>
    </PageContainer>
  );
}