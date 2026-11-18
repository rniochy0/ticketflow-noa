-- Pedidos de material (toner, ratos, teclados, monitores...) com aprovação do
-- gestor, stock com alerta e guia de entrega.
--
-- SEGURANÇA: os clientes (role "authenticated") só LEEM estas tabelas. Todas as
-- escritas passam por funções SECURITY DEFINER que validam o perfil, o estado
-- do pedido e os limites — assim ninguém consegue, por exemplo, aprovar o
-- próprio pedido, saltar a aprovação ou mexer no stock sem deixar rasto.

create sequence if not exists public.supply_request_seq;
create sequence if not exists public.delivery_guide_seq;

-- ============ CATÁLOGO ============
create table public.supply_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  ref text check (ref is null or char_length(ref) <= 50),
  kind text not null default 'OUTRO' check (kind in ('TONER', 'PERIFERICO', 'MONITOR', 'OUTRO')),
  unit text not null default 'un' check (char_length(unit) between 1 and 20),
  stock_qty integer not null default 0 check (stock_qty >= 0),
  min_stock integer not null default 0 check (min_stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index supply_items_name_uq on public.supply_items (lower(name));

-- ============ PEDIDOS ============
create table public.supply_requests (
  id uuid primary key default gen_random_uuid(),
  number text not null unique
    default ('MAT-' || lpad(nextval('public.supply_request_seq')::text, 5, '0')),
  requester_id uuid not null references public.profiles(id),
  store_id uuid not null references public.stores(id),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'REJECTED', 'DELIVERED', 'CANCELLED')),
  notes text check (notes is null or char_length(notes) <= 500),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 300),
  delivered_by uuid references public.profiles(id),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.supply_requests (requester_id);
create index on public.supply_requests (status, created_at desc);

create table public.supply_request_items (
  request_id uuid not null references public.supply_requests(id) on delete cascade,
  item_id uuid not null references public.supply_items(id),
  qty integer not null check (qty between 1 and 50),
  primary key (request_id, item_id)
);

-- ============ MOVIMENTOS DE STOCK (auditoria) ============
create table public.supply_stock_movements (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.supply_items(id),
  delta integer not null check (delta <> 0),
  reason text not null check (char_length(reason) between 3 and 200),
  request_id uuid references public.supply_requests(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index on public.supply_stock_movements (item_id, created_at desc);

-- ============ GUIAS DE ENTREGA ============
-- Guarda uma cópia (snapshot) dos nomes/linhas: renomear um artigo ou mudar de
-- site depois não altera um documento já emitido.
create table public.delivery_guides (
  id uuid primary key default gen_random_uuid(),
  number text not null unique
    default ('GE-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.delivery_guide_seq')::text, 5, '0')),
  request_id uuid not null unique references public.supply_requests(id),
  issued_by uuid not null references public.profiles(id),
  issued_by_name text not null default '',
  issued_at timestamptz not null default now(),
  received_by_name text not null check (char_length(received_by_name) between 2 and 120),
  requester_name text not null,
  store_name text not null,
  lines jsonb not null,
  created_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.supply_items
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.supply_requests
  for each row execute function public.set_updated_at();

-- ============ PRIVILÉGIOS DE TABELA ============
-- Por omissão o Supabase dá tudo a anon/authenticated; retiramos e damos só o necessário.
revoke all on public.supply_items, public.supply_requests, public.supply_request_items,
  public.supply_stock_movements, public.delivery_guides from anon, authenticated;

grant select on public.supply_items, public.supply_requests, public.supply_request_items,
  public.supply_stock_movements, public.delivery_guides to authenticated;

-- Gestor/admin gere o catálogo, mas NUNCA o stock directamente (stock_qty fica
-- de fora dos privilégios de coluna: só as funções abaixo o alteram, com rasto).
grant insert (name, ref, kind, unit, min_stock, is_active) on public.supply_items to authenticated;
grant update (name, ref, kind, unit, min_stock, is_active) on public.supply_items to authenticated;

-- ============ RLS ============
alter table public.supply_items enable row level security;
alter table public.supply_requests enable row level security;
alter table public.supply_request_items enable row level security;
alter table public.supply_stock_movements enable row level security;
alter table public.delivery_guides enable row level security;

create policy supply_items_select on public.supply_items
  for select to authenticated using (is_active or public.is_agent());
create policy supply_items_insert on public.supply_items
  for insert to authenticated with check (public.is_admin());
create policy supply_items_update on public.supply_items
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy supply_requests_select on public.supply_requests
  for select to authenticated
  using (requester_id = (select auth.uid()) or public.is_agent());

-- O subselect corre com o RLS de supply_requests: quem não vê o pedido não vê as linhas
create policy supply_request_items_select on public.supply_request_items
  for select to authenticated
  using (exists (select 1 from public.supply_requests r where r.id = request_id));

create policy supply_movements_select on public.supply_stock_movements
  for select to authenticated using (public.is_agent());

create policy delivery_guides_select on public.delivery_guides
  for select to authenticated
  using (exists (select 1 from public.supply_requests r where r.id = request_id));

-- ============ FUNÇÕES ============

-- Criar pedido: p_lines = [{"item_id": "<uuid>", "qty": 2}, ...]
create or replace function public.create_supply_request(p_notes text, p_lines jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_store uuid;
  v_active boolean;
  v_id uuid;
  v_line jsonb;
  v_item uuid;
  v_qty integer;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;

  select store_id, is_active into v_store, v_active from public.profiles where id = v_uid;
  if not coalesce(v_active, false) then
    raise exception 'Conta inativa.' using errcode = '42501';
  end if;
  if v_store is null then
    raise exception 'A tua conta não tem site associado.' using errcode = 'P0001';
  end if;
  if p_notes is not null and char_length(p_notes) > 500 then
    raise exception 'As notas não podem passar de 500 caracteres.' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Linhas inválidas.' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(p_lines);
  if v_count < 1 or v_count > 20 then
    raise exception 'Escolhe entre 1 e 20 artigos.' using errcode = '22023';
  end if;

  insert into public.supply_requests (requester_id, store_id, notes)
  values (v_uid, v_store, nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into v_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    begin
      v_item := (v_line ->> 'item_id')::uuid;
      v_qty := (v_line ->> 'qty')::integer;
    exception when others then
      raise exception 'Linha inválida.' using errcode = '22023';
    end;

    if v_qty is null or v_qty < 1 or v_qty > 50 then
      raise exception 'Quantidade inválida (1 a 50).' using errcode = '22023';
    end if;
    if not exists (select 1 from public.supply_items where id = v_item and is_active) then
      raise exception 'Artigo inválido ou inativo.' using errcode = '22023';
    end if;

    -- artigo repetido => violação da chave primária (23505)
    insert into public.supply_request_items (request_id, item_id, qty)
    values (v_id, v_item, v_qty);
  end loop;

  return v_id;
end;
$$;

-- Gestor/admin aprova ou rejeita (nunca o próprio pedido)
create or replace function public.decide_supply_request(p_id uuid, p_approve boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_req public.supply_requests;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;

  select * into v_req from public.supply_requests where id = p_id for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if v_req.status <> 'PENDING' then
    raise exception 'O pedido já não está pendente.' using errcode = 'P0001';
  end if;
  if v_req.requester_id = v_uid then
    raise exception 'Não podes decidir o teu próprio pedido.' using errcode = 'P0001';
  end if;
  if p_note is not null and char_length(p_note) > 300 then
    raise exception 'A nota não pode passar de 300 caracteres.' using errcode = '22023';
  end if;
  if not p_approve and nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'Indica o motivo da rejeição.' using errcode = '22023';
  end if;

  update public.supply_requests
  set status = case when p_approve then 'APPROVED' else 'REJECTED' end,
      decided_by = v_uid,
      decided_at = now(),
      decision_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_id;
end;
$$;

-- O próprio solicitante cancela enquanto está pendente
create or replace function public.cancel_supply_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.supply_requests;
begin
  select * into v_req from public.supply_requests where id = p_id for update;
  if not found or v_req.requester_id <> (select auth.uid()) then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if v_req.status <> 'PENDING' then
    raise exception 'Só é possível cancelar pedidos pendentes.' using errcode = 'P0001';
  end if;
  update public.supply_requests set status = 'CANCELLED' where id = p_id;
end;
$$;

-- Entrega: desconta o stock, regista os movimentos e emite a guia. Tudo numa
-- só transacção; se faltar stock de QUALQUER artigo, nada é alterado.
create or replace function public.deliver_supply_request(p_id uuid, p_received_by text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_req public.supply_requests;
  v_line record;
  v_stock integer;
  v_lines jsonb := '[]'::jsonb;
  v_low jsonb := '[]'::jsonb;
  v_recv text := btrim(coalesce(p_received_by, ''));
  v_req_name text;
  v_issuer_name text;
  v_store_name text;
  v_guide_id uuid;
  v_number text;
begin
  if not public.is_agent() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if char_length(v_recv) < 2 or char_length(v_recv) > 120 then
    raise exception 'Indica quem recebeu (2 a 120 caracteres).' using errcode = '22023';
  end if;

  select * into v_req from public.supply_requests where id = p_id for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if v_req.status <> 'APPROVED' then
    raise exception 'Só pedidos aprovados podem ser entregues.' using errcode = 'P0001';
  end if;

  -- ordem fixa (por nome) evita deadlocks entre duas entregas em simultâneo
  for v_line in
    select ri.item_id, ri.qty, i.name, i.ref, i.unit, i.stock_qty, i.min_stock
    from public.supply_request_items ri
    join public.supply_items i on i.id = ri.item_id
    where ri.request_id = p_id
    order by i.name
    for update of i
  loop
    if v_line.stock_qty < v_line.qty then
      raise exception 'Stock insuficiente de "%": há %, pedido %.',
        v_line.name, v_line.stock_qty, v_line.qty using errcode = 'P0001';
    end if;

    update public.supply_items set stock_qty = stock_qty - v_line.qty
    where id = v_line.item_id
    returning stock_qty into v_stock;

    insert into public.supply_stock_movements (item_id, delta, reason, request_id, created_by)
    values (v_line.item_id, -v_line.qty, 'Entrega ' || v_req.number, p_id, v_uid);

    v_lines := v_lines || jsonb_build_object(
      'name', v_line.name, 'ref', v_line.ref, 'unit', v_line.unit, 'qty', v_line.qty);

    if v_stock <= v_line.min_stock then
      v_low := v_low || jsonb_build_object(
        'name', v_line.name, 'stock_qty', v_stock, 'min_stock', v_line.min_stock);
    end if;
  end loop;

  select full_name into v_req_name from public.profiles where id = v_req.requester_id;
  select full_name into v_issuer_name from public.profiles where id = v_uid;
  select name into v_store_name from public.stores where id = v_req.store_id;

  insert into public.delivery_guides
    (request_id, issued_by, issued_by_name, received_by_name, requester_name, store_name, lines)
  values
    (p_id, v_uid, coalesce(v_issuer_name, ''), v_recv, coalesce(v_req_name, ''), coalesce(v_store_name, ''), v_lines)
  returning id, number into v_guide_id, v_number;

  update public.supply_requests
  set status = 'DELIVERED', delivered_by = v_uid, delivered_at = now()
  where id = p_id;

  return jsonb_build_object('guide_id', v_guide_id, 'guide_number', v_number, 'low_items', v_low);
end;
$$;

-- Entrada/saída de stock avulsa (compra, contagem, perda). Motivo obrigatório.
create or replace function public.adjust_supply_stock(p_item_id uuid, p_delta integer, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_reason text := btrim(coalesce(p_reason, ''));
  v_stock integer;
begin
  if not public.is_agent() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 10000 then
    raise exception 'Quantidade inválida.' using errcode = '22023';
  end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 200 then
    raise exception 'Indica o motivo (3 a 200 caracteres).' using errcode = '22023';
  end if;

  select stock_qty into v_stock from public.supply_items where id = p_item_id for update;
  if not found then
    raise exception 'Artigo não encontrado.' using errcode = 'P0002';
  end if;
  if v_stock + p_delta < 0 then
    raise exception 'O stock não pode ficar negativo.' using errcode = 'P0001';
  end if;

  update public.supply_items set stock_qty = stock_qty + p_delta
  where id = p_item_id returning stock_qty into v_stock;

  insert into public.supply_stock_movements (item_id, delta, reason, created_by)
  values (p_item_id, p_delta, v_reason, v_uid);

  return v_stock;
end;
$$;

-- Emails para notificar, sem abrir o RLS de profiles: só quem tem relação com o
-- pedido (solicitante ou equipa) obtém a lista.
create or replace function public.supply_notify_emails(p_id uuid, p_audience text)
returns table (email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.email
  from public.profiles p
  where p.is_active
    and exists (
      select 1 from public.supply_requests r
      where r.id = p_id
        and (r.requester_id = (select auth.uid()) or public.is_agent())
    )
    and (
      (p_audience = 'MANAGERS' and p.role in ('MANAGER', 'ADMIN'))
      or (p_audience = 'AGENTS' and p.role in ('TECHNICIAN', 'MANAGER', 'ADMIN'))
      or (p_audience = 'REQUESTER' and p.id = (select r2.requester_id from public.supply_requests r2 where r2.id = p_id))
    )
$$;

revoke all on function public.create_supply_request(text, jsonb) from public, anon;
revoke all on function public.decide_supply_request(uuid, boolean, text) from public, anon;
revoke all on function public.cancel_supply_request(uuid) from public, anon;
revoke all on function public.deliver_supply_request(uuid, text) from public, anon;
revoke all on function public.adjust_supply_stock(uuid, integer, text) from public, anon;
revoke all on function public.supply_notify_emails(uuid, text) from public, anon;
grant execute on function public.create_supply_request(text, jsonb) to authenticated;
grant execute on function public.decide_supply_request(uuid, boolean, text) to authenticated;
grant execute on function public.cancel_supply_request(uuid) to authenticated;
grant execute on function public.deliver_supply_request(uuid, text) to authenticated;
grant execute on function public.adjust_supply_stock(uuid, integer, text) to authenticated;
grant execute on function public.supply_notify_emails(uuid, text) to authenticated;
