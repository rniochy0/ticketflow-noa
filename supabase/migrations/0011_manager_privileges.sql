-- O GESTOR (MANAGER) passa a ter os mesmos privilégios do ADMIN.
--
-- Decisão do negócio: o gestor é quem gere quase tudo nos tickets (atender,
-- atribuir, administrar sites/categorias/utilizadores).
--
-- Nota de nomes: is_admin() passa a significar "ADMIN ou MANAGER". Mantive o
-- nome para não reescrever todas as policies (stores, categories, profiles...).
-- Se um dia o gestor voltar a ter menos poderes, é só alterar aqui.

create or replace function public.is_agent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('TECHNICIAN', 'MANAGER', 'ADMIN'), false)
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('MANAGER', 'ADMIN'), false)
$$;

-- Responsável por um ticket: qualquer perfil de atendimento ativo
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
        where id = new.assignee_id and is_active and role in ('TECHNICIAN', 'MANAGER', 'ADMIN')
      ) then
        raise exception 'O responsável tem de ser um utilizador de atendimento activo' using errcode = '23514';
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

-- Emails da equipa a notificar (novo pedido / nova mensagem)
create or replace function public.ticket_staff_emails(p_ticket_id uuid)
returns table (email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.email
  from public.profiles p
  where p.role in ('TECHNICIAN', 'MANAGER', 'ADMIN')
    and p.is_active
    and exists (
      select 1 from public.tickets t
      where t.id = p_ticket_id
        and (t.requester_id = (select auth.uid()) or public.is_staff())
    )
$$;
