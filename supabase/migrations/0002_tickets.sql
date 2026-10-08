-- ============ ENUMS ============
create type public.ticket_status as enum
  ('OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED');
create type public.ticket_priority as enum ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
create type public.ticket_event_type as enum
  ('CREATED', 'STATUS_CHANGED', 'ASSIGNEE_CHANGED', 'MESSAGE_SENT', 'RESOLVED', 'CLOSED');

-- ============ HELPER: técnico ou admin ============
-- MANAGER só consulta (dashboards), não atende tickets
create or replace function public.is_agent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('TECHNICIAN', 'ADMIN'), false)
$$;

revoke all on function public.is_agent() from public, anon;
grant execute on function public.is_agent() to authenticated;

-- ============ SUBCATEGORIA TEM DE PERTENCER À CATEGORIA ============
alter table public.subcategories
  add constraint subcategories_id_category_key unique (id, category_id);

-- ============ NÚMERO SEQUENCIAL NOA-00001 ============
create sequence public.ticket_number_seq;
revoke all on sequence public.ticket_number_seq from public, anon, authenticated;

-- ============ TABELAS ============
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  title text not null check (char_length(btrim(title)) between 3 and 150),
  description text not null check (char_length(btrim(description)) between 5 and 5000),
  category_id uuid not null references public.categories(id) on delete restrict,
  subcategory_id uuid,
  store_id uuid not null references public.stores(id) on delete restrict,
  priority public.ticket_priority not null default 'MEDIUM',
  status public.ticket_status not null default 'OPEN',
  requester_id uuid not null references public.profiles(id) on delete restrict,
  assignee_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  foreign key (subcategory_id, category_id)
    references public.subcategories (id, category_id)
);

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create table public.ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type public.ticket_event_type not null,
  from_value text,
  to_value text,
  created_at timestamptz not null default now()
);

-- ============ INDEXES ============
create index on public.tickets (requester_id, created_at desc);
create index on public.tickets (assignee_id);
create index on public.tickets (status);
create index on public.tickets (store_id);
create index on public.tickets (category_id);
create index on public.tickets (created_at desc);
create index on public.ticket_messages (ticket_id, created_at);
create index on public.ticket_events (ticket_id, created_at);

create trigger set_updated_at before update on public.tickets
  for each row execute function public.set_updated_at();

-- ============ TRIGGER: INSERT (regras que o cliente não controla) ============
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

  if not exists (select 1 from public.stores where id = new.store_id and is_active) then
    raise exception 'Loja inválida ou inactiva' using errcode = '23514';
  end if;
  if not exists (select 1 from public.categories where id = new.category_id and is_active) then
    raise exception 'Categoria inválida ou inactiva' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger tickets_before_insert before insert on public.tickets
  for each row execute function public.tickets_before_insert();

-- ============ TRIGGER: UPDATE (permissões por coluna + transições) ============
create or replace function public.tickets_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  allowed boolean;
begin
  -- uid nulo = SQL Editor / service role (contexto de confiança)
  if uid is not null then
    -- Imutáveis para toda a gente
    if new.id is distinct from old.id
       or new.number is distinct from old.number
       or new.title is distinct from old.title
       or new.description is distinct from old.description
       or new.store_id is distinct from old.store_id
       or new.requester_id is distinct from old.requester_id
       or new.created_at is distinct from old.created_at then
      raise exception 'Campos do ticket não editáveis' using errcode = '42501';
    end if;

    if not public.is_agent() then
      -- Solicitante: só pode fechar um ticket já resolvido
      if old.requester_id <> uid
         or new.priority is distinct from old.priority
         or new.category_id is distinct from old.category_id
         or new.subcategory_id is distinct from old.subcategory_id
         or new.assignee_id is distinct from old.assignee_id
         or not (old.status = 'RESOLVED' and new.status = 'CLOSED') then
        raise exception 'Operação não permitida' using errcode = '42501';
      end if;
    end if;

    if new.assignee_id is distinct from old.assignee_id and new.assignee_id is not null then
      if not exists (
        select 1 from public.profiles
        where id = new.assignee_id and is_active and role in ('TECHNICIAN', 'ADMIN')
      ) then
        raise exception 'O responsável tem de ser um técnico activo' using errcode = '23514';
      end if;
    end if;
  end if;

  -- Regras de transição de estado
  if new.status is distinct from old.status then
    allowed := case old.status
      when 'OPEN'         then new.status = 'IN_PROGRESS'
      when 'IN_PROGRESS'  then new.status in ('WAITING_USER', 'RESOLVED')
      when 'WAITING_USER' then new.status in ('IN_PROGRESS', 'RESOLVED')
      when 'RESOLVED'     then new.status in ('CLOSED', 'IN_PROGRESS')
      else false
    end;
    if not allowed then
      raise exception 'Transição de estado inválida: % -> %', old.status, new.status
        using errcode = '23514';
    end if;

    if new.status = 'RESOLVED' then new.resolved_at := now(); end if;
    if new.status = 'CLOSED' then new.closed_at := now(); end if;
    if old.status = 'RESOLVED' and new.status = 'IN_PROGRESS' then new.resolved_at := null; end if;
  end if;

  return new;
end;
$$;

create trigger tickets_before_update before update on public.tickets
  for each row execute function public.tickets_before_update();

-- ============ HISTÓRICO AUTOMÁTICO ============
-- Só os triggers escrevem em ticket_events: ninguém consegue forjar histórico
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
    insert into public.ticket_events (ticket_id, actor_id, type)
    values (new.id, coalesce(uid, new.requester_id), 'CREATED');
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

create trigger log_ticket_events after insert or update on public.tickets
  for each row execute function public.log_ticket_events();

create or replace function public.log_message_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ticket_events (ticket_id, actor_id, type)
  values (new.ticket_id, new.author_id, 'MESSAGE_SENT');
  return null;
end;
$$;

create trigger log_message_event after insert on public.ticket_messages
  for each row execute function public.log_message_event();

revoke all on function public.tickets_before_insert() from public, anon, authenticated;
revoke all on function public.tickets_before_update() from public, anon, authenticated;
revoke all on function public.log_ticket_events() from public, anon, authenticated;
revoke all on function public.log_message_event() from public, anon, authenticated;

-- ============ RLS ============
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.ticket_events enable row level security;

-- Tickets: o solicitante vê os seus; equipa (IT/gestor/admin) vê todos
create policy "tickets_select" on public.tickets
  for select to authenticated
  using (
    (select public.current_user_role()) is not null
    and (requester_id = (select auth.uid()) or (select public.is_staff()))
  );

create policy "tickets_insert" on public.tickets
  for insert to authenticated
  with check (
    (select public.current_user_role()) is not null
    and requester_id = (select auth.uid())
  );

create policy "tickets_update" on public.tickets
  for update to authenticated
  using (
    (select public.current_user_role()) is not null
    and ((select public.is_agent()) or requester_id = (select auth.uid()))
  )
  with check (
    (select public.current_user_role()) is not null
    and ((select public.is_agent()) or requester_id = (select auth.uid()))
  );
-- Sem policy de DELETE: tickets nunca são apagados

-- Mensagens: vê quem vê o ticket; escreve o solicitante ou o técnico, em tickets não fechados
create policy "messages_select" on public.ticket_messages
  for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id));

create policy "messages_insert" on public.ticket_messages
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and t.status <> 'CLOSED'
        and (t.requester_id = (select auth.uid()) or (select public.is_agent()))
    )
  );
-- Sem UPDATE/DELETE: mensagens são imutáveis

create policy "events_select" on public.ticket_events
  for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id));
-- Sem INSERT/UPDATE/DELETE: só os triggers escrevem

-- Defesa em profundidade
revoke all on public.tickets, public.ticket_messages, public.ticket_events from anon;
revoke delete on public.tickets from authenticated;
revoke update, delete on public.ticket_messages from authenticated;
revoke insert, update, delete on public.ticket_events from authenticated;

-- ============ REALTIME (o chat respeita o RLS) ============
alter publication supabase_realtime add table public.tickets, public.ticket_messages;