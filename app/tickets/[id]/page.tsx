import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { PageContainer } from "@/components/layout/PageContainer";
import { Stack, MutedText } from "@/components/layout/Stack";
import { BackLink } from "@/components/ui/BackLink";
import { TicketHeader } from "@/components/tickets/TicketHeader";
import { TicketMessages, type MessageRow } from "@/components/tickets/TicketMessages";
import { StaffActionsPanel, RequesterCloseAction } from "@/components/tickets/TicketActions";
import type { TicketStatus } from "@/components/ui/Badge";

// Sem os tipos gerados do Supabase, o cliente não conhece a cardinalidade
// das relações e assume array por segurança — aqui sabemos, pela migração,
// qual é a forma real de cada uma.
type TicketDetailRow = {
  id: string;
  number: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: string;
  created_at: string;
  requester_id: string;
  assignee_id: string | null;
  categories: { name: string } | null;
  stores: { name: string } | null;
};

type RawMessageRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author: { full_name: string } | null;
};

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  // Sem filtro por requester/staff: o RLS já decide. Se não vier nada,
  // pode ser "não existe" ou "não é teu" — a mensagem não distingue os dois.
  const { data } = await supabase
    .from("tickets")
    .select(
      `id, number, title, description, status, priority, created_at,
       requester_id, assignee_id, categories(name), stores(name)`
    )
    .eq("id", id)
    .single();

  const ticket = data as TicketDetailRow | null;
  if (!ticket) notFound();

  const isAgent = can(user.role, "ticket:handle");
  const isRequester = ticket.requester_id === user.id;

  const [{ data: rawMessages }, techniciansResult] = await Promise.all([
    supabase
      .from("ticket_messages")
      .select("id, body, created_at, author_id, author:profiles!ticket_messages_author_id_fkey(full_name)")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true }),
    isAgent
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("role", ["TECHNICIAN", "ADMIN"])
          .eq("is_active", true)
          .order("full_name")
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const messages: MessageRow[] = ((rawMessages ?? []) as unknown as RawMessageRow[]).map(
    (m) => ({
      id: m.id,
      body: m.body,
      created_at: m.created_at,
      authorName: m.author?.full_name || "—",
      isOwn: m.author_id === user.id,
    })
  );

  const canReply = ticket.status !== "CLOSED" && (isRequester || isAgent);

  return (
    <PageContainer>
      <BackLink href={isAgent ? "/it/tickets" : "/tickets"} />

      <Card>
        <Stack $gap="sm">
          <TicketHeader number={ticket.number} status={ticket.status} />
          <h2 style={{ margin: 0, fontSize: 18 }}>{ticket.title}</h2>
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{ticket.description}</p>
          <MutedText>
            {ticket.categories?.name} · {ticket.stores?.name} · Prioridade: {ticket.priority}
          </MutedText>
        </Stack>
      </Card>

      {isAgent && (
        <StaffActionsPanel
          ticketId={ticket.id}
          status={ticket.status}
          priority={ticket.priority}
          assigneeId={ticket.assignee_id}
          currentUserId={user.id}
          technicians={techniciansResult.data ?? []}
        />
      )}

      {isRequester && !isAgent && (
        <RequesterCloseAction ticketId={ticket.id} status={ticket.status} />
      )}

      <Card>
        <TicketMessages ticketId={ticket.id} messages={messages} canReply={canReply} />
      </Card>
    </PageContainer>
  );
}