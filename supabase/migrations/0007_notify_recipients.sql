-- Destinatários de notificações por email.
--
-- PROBLEMA: o RLS de profiles só deixa um colaborador ler o PRÓPRIO perfil.
-- Quando um colaborador abre um pedido, a query "emails do IT" devolvia lista
-- vazia e ninguém era notificado. Em vez de abrir o RLS de profiles (expondo
-- todos os emails), estas funções devolvem SÓ o necessário, e só a quem tem
-- relação com o ticket (solicitante ou staff).

create or replace function public.ticket_staff_emails(p_ticket_id uuid)
returns table (email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.email
  from public.profiles p
  where p.role in ('TECHNICIAN', 'ADMIN')
    and p.is_active
    and exists (
      select 1 from public.tickets t
      where t.id = p_ticket_id
        and (t.requester_id = (select auth.uid()) or public.is_staff())
    )
$$;

create or replace function public.ticket_assignee_email(p_ticket_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.email
  from public.tickets t
  join public.profiles p on p.id = t.assignee_id and p.is_active
  where t.id = p_ticket_id
    and (t.requester_id = (select auth.uid()) or public.is_staff())
$$;

revoke all on function public.ticket_staff_emails(uuid) from public, anon;
revoke all on function public.ticket_assignee_email(uuid) from public, anon;
grant execute on function public.ticket_staff_emails(uuid) to authenticated;
grant execute on function public.ticket_assignee_email(uuid) to authenticated;
