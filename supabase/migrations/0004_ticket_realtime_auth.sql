-- Realtime (mensagens ao vivo + "a escrever") por canal privado, um por ticket.
-- Topic do canal: "ticket:<ticket_id>".
--
-- IMPORTANTE: NÃO uso a policy de exemplo da documentação do Supabase
-- (using (true)), porque isso deixaria qualquer autenticado ouvir e escrever
-- em QUALQUER ticket, só por adivinhar/saber o UUID. Aqui a policy verifica
-- a mesma regra que já protege a leitura da tabela tickets: só o solicitante
-- ou um agente/staff desse ticket específico pode entrar no canal.

create policy "ticket_channel_receive" on "realtime"."messages"
for select
to authenticated
using (
  exists (
    select 1 from public.tickets t
    where t.id::text = split_part(realtime.topic(), ':', 2)
      and (t.requester_id = (select auth.uid()) or public.is_staff())
  )
);

create policy "ticket_channel_send" on "realtime"."messages"
for insert
to authenticated
with check (
  exists (
    select 1 from public.tickets t
    where t.id::text = split_part(realtime.topic(), ':', 2)
      and (t.requester_id = (select auth.uid()) or public.is_staff())
  )
);

-- Dispara um broadcast "chegou mensagem nova" para quem estiver no canal
-- do ticket. O payload não leva o nome do autor (isso fica para o cliente
-- voltar a ler via query normal, já protegida por RLS) — assim o broadcast
-- em si não expõe mais informação do que a policy acima já autoriza.
create or replace function public.broadcast_ticket_message()
returns trigger
security definer
language plpgsql
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'ticket:' || new.ticket_id::text,  -- topic
    tg_op,                             -- event
    tg_op,                             -- operation
    tg_table_name,                     -- table
    tg_table_schema,                   -- schema
    new,
    null
  );
  return null;
end;
$$;

create trigger broadcast_ticket_message
after insert on public.ticket_messages
for each row execute function public.broadcast_ticket_message();