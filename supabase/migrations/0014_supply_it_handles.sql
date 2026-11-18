-- O IT (técnico, gestor, admin) trata os pedidos de material do princípio ao
-- fim: aceita/rejeita e entrega, sem depender do gestor. O gestor continua a
-- poder ver e a intervir, mas deixa de ser um passo obrigatório.
-- Mantém-se a separação de funções: ninguém decide nem entrega o PRÓPRIO pedido.

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
  if not public.is_agent() then
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
    raise exception 'Não podes tratar o teu próprio pedido; pede a outro elemento do IT.' using errcode = 'P0001';
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
  -- entrega directa a partir de PENDING (sem passo de aprovação) ou depois de aceite
  if v_req.status not in ('PENDING', 'APPROVED') then
    raise exception 'Este pedido já não pode ser entregue.' using errcode = 'P0001';
  end if;
  if v_req.requester_id = v_uid then
    raise exception 'Não podes entregar o teu próprio pedido; pede a outro elemento do IT.' using errcode = 'P0001';
  end if;

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
  set status = 'DELIVERED', delivered_by = v_uid, delivered_at = now(),
      -- entrega directa: regista também quem tratou do pedido
      decided_by = coalesce(decided_by, v_uid), decided_at = coalesce(decided_at, now())
  where id = p_id;

  return jsonb_build_object('guide_id', v_guide_id, 'guide_number', v_number, 'low_items', v_low);
end;
$$;
