-- Nomes das pessoas envolvidas num ticket (para mensagens e histórico).
--
-- PROBLEMA: o RLS de profiles só deixa um colaborador ler o PRÓPRIO perfil,
-- por isso as respostas do IT apareciam sem nome ("—") para quem abriu o
-- pedido. Esta função devolve SÓ id + nome (nunca email/role) das pessoas
-- que participam naquele ticket, e só para o solicitante ou a equipa.
create or replace function public.ticket_participants(p_ticket_id uuid)
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name
  from public.profiles p
  where exists (
      select 1 from public.tickets t
      where t.id = p_ticket_id
        and (t.requester_id = (select auth.uid()) or public.is_staff())
    )
    and p.id in (
      select t.requester_id from public.tickets t where t.id = p_ticket_id
      union
      select t.assignee_id from public.tickets t where t.id = p_ticket_id
      union
      select m.author_id from public.ticket_messages m where m.ticket_id = p_ticket_id
      union
      select e.actor_id from public.ticket_events e where e.ticket_id = p_ticket_id
      union
      select (case when e.type = 'ASSIGNEE_CHANGED' then e.from_value::uuid end)
        from public.ticket_events e where e.ticket_id = p_ticket_id
      union
      select (case when e.type = 'ASSIGNEE_CHANGED' then e.to_value::uuid end)
        from public.ticket_events e where e.ticket_id = p_ticket_id
    )
$$;

revoke all on function public.ticket_participants(uuid) from public, anon;
grant execute on function public.ticket_participants(uuid) to authenticated;
