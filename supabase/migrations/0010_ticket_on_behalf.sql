-- Pedidos abertos pelo IT em nome de um colaborador (telefone, presencial).
--
-- Regras:
--  * Só TECHNICIAN/ADMIN (is_agent) podem abrir um pedido com outro solicitante,
--    e esse solicitante tem de ser um utilizador ativo.
--  * created_by guarda SEMPRE quem registou (preenchido pelo trigger, o cliente
--    não o controla), e o histórico mostra "abriu em nome de".

alter table public.tickets
  add column created_by uuid references public.profiles(id) on delete set null;

-- Pedidos antigos: quem registou foi o próprio solicitante
update public.tickets set created_by = requester_id where created_by is null;

create or replace function public.tickets_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.number := 'NOA-' || lpad(nextval('public.ticket_number_seq')::text, 5, '0');
  new.status := 'OPEN';
  new.assignee_id := null;
  new.resolved_at := null;
  new.closed_at := null;
  new.created_by := coalesce((select auth.uid()), new.requester_id);

  if not exists (select 1 from public.stores where id = new.store_id and is_active) then
    raise exception 'Loja inválida ou inactiva' using errcode = '23514';
  end if;
  if not exists (select 1 from public.categories where id = new.category_id and is_active) then
    raise exception 'Categoria inválida ou inactiva' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- INSERT: o próprio solicitante, OU um agente em nome de um utilizador ativo
drop policy "tickets_insert" on public.tickets;
create policy "tickets_insert" on public.tickets
  for insert to authenticated
  with check (
    (select public.current_user_role()) is not null
    and (
      requester_id = (select auth.uid())
      or (
        (select public.is_agent())
        and exists (
          select 1 from public.profiles p
          where p.id = requester_id and p.is_active
        )
      )
    )
  );

-- Histórico: no evento CREATED, to_value guarda o solicitante quando quem
-- registou é outra pessoa
create or replace function public.log_ticket_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into public.ticket_events (ticket_id, actor_id, type, to_value)
    values (
      new.id,
      coalesce(uid, new.requester_id),
      'CREATED',
      case when uid is not null and uid <> new.requester_id
           then new.requester_id::text end
    );
  else
    if new.status is distinct from old.status then
      insert into public.ticket_events (ticket_id, actor_id, type, from_value, to_value)
      values (new.id, uid, 'STATUS_CHANGED', old.status::text, new.status::text);
      if new.status = 'RESOLVED' then
        insert into public.ticket_events (ticket_id, actor_id, type) values (new.id, uid, 'RESOLVED');
      elsif new.status = 'CLOSED' then
        insert into public.ticket_events (ticket_id, actor_id, type) values (new.id, uid, 'CLOSED');
      end if;
    end if;
    if new.assignee_id is distinct from old.assignee_id then
      insert into public.ticket_events (ticket_id, actor_id, type, from_value, to_value)
      values (new.id, uid, 'ASSIGNEE_CHANGED', old.assignee_id::text, new.assignee_id::text);
    end if;
  end if;
  return null;
end;
$$;

-- Os nomes do solicitante e do agente já saem de ticket_participants
-- (requester_id e actor_id), por isso não há mais nada a alterar aí.