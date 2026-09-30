import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { PageContainer } from "@/components/layout/PageContainer";
import { Stack, MutedText } from "@/components/layout/Stack";
import { BackLink } from "@/components/ui/BackLink";
import { TicketHeader } from "@/components/tickets/TicketHeader";
import type { TicketStatus } from "@/components/ui/Badge";

// Sem os tipos gerados do Supabase (npx supabase gen types), o cliente não
// conhece a cardinalidade da relação e assume array por segurança.
// Aqui sabemos, pela migração, que é sempre 1 categoria e 1 loja por ticket.
type TicketDetailRow = {
  id: string;
  number: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  categories: { name: string } | null;
  stores: { name: string } | null;
};

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  // Sem filtro por requester/staff: o RLS já decide. Se não vier nada,
  // pode ser "não existe" ou "não é teu" — a mensagem não distingue os dois.
  const { data } = await supabase
    .from("tickets")
    .select(
      "id, number, title, description, status, priority, created_at, categories(name), stores(name)"
    )
    .eq("id", id)
    .single();

  const ticket = data as TicketDetailRow | null;

  if (!ticket) notFound();

  return (
    <PageContainer>
      <BackLink href="/tickets" label="Meus pedidos" />
      <Card>
        <Stack $gap="sm">
          <TicketHeader number={ticket.number} status={ticket.status as TicketStatus} />
          <h2 style={{ margin: 0, fontSize: 18 }}>{ticket.title}</h2>
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{ticket.description}</p>
          <MutedText>
            {ticket.categories?.name} · {ticket.stores?.name} · Prioridade: {ticket.priority}
          </MutedText>
        </Stack>
      </Card>
    </PageContainer>
  );
}