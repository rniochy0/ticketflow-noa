-- Anexos de tickets e mensagens (screenshots, fotos do equipamento, PDFs).
--
-- Princípios:
--  * Bucket PRIVADO: nenhum ficheiro tem URL público. O acesso passa sempre
--    por uma rota da app que verifica a sessão e gera um URL assinado de 60s.


-- Uma mensagem só pode ter anexos do seu próprio ticket (FK composta abaixo)
alter table public.ticket_messages
  add constraint ticket_messages_id_ticket_key unique (id, ticket_id);

create table public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  message_id uuid,
  uploader_id uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text not null
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 4194304),
  check (starts_with(storage_path, ticket_id::text || '/')),
  -- message_id nulo = anexo do pedido em si (não de uma mensagem)
  foreign key (message_id, ticket_id)
    references public.ticket_messages (id, ticket_id) on delete cascade
);

create index on public.ticket_attachments (ticket_id, created_at);
create index on public.ticket_attachments (message_id);

-- ============ LIMITES (contra abuso de espaço de armazenamento) ============
create or replace function public.ticket_attachments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.ticket_attachments
      where ticket_id = new.ticket_id) >= 30 then
    raise exception 'Limite de anexos por pedido atingido' using errcode = '23514';
  end if;

  if new.message_id is not null and (select count(*) from public.ticket_attachments
      where message_id = new.message_id) >= 5 then
    raise exception 'Limite de anexos por mensagem atingido' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger ticket_attachments_before_insert
  before insert on public.ticket_attachments
  for each row execute function public.ticket_attachments_before_insert();

revoke all on function public.ticket_attachments_before_insert()
  from public, anon, authenticated;

-- ============ RLS DA TABELA ============
alter table public.ticket_attachments enable row level security;

-- Vê o anexo quem vê o ticket (o RLS de tickets aplica-se à subquery)
create policy "attachments_select" on public.ticket_attachments
  for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id));

-- Anexa quem escreve no ticket (solicitante ou agente), em tickets não fechados,
-- e só a mensagens que ele próprio escreveu.
create policy "attachments_insert" on public.ticket_attachments
  for insert to authenticated
  with check (
    uploader_id = (select auth.uid())
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and t.status <> 'CLOSED'
        and (t.requester_id = (select auth.uid()) or (select public.is_agent()))
    )
    and (
      message_id is null
      or exists (
        select 1 from public.ticket_messages m
        where m.id = message_id and m.author_id = (select auth.uid())
      )
    )
  );

revoke all on public.ticket_attachments from anon;
revoke update, delete on public.ticket_attachments from authenticated;

-- ============ TEMPO REAL ============
-- Reutiliza a função da migração 0004 (usa new.ticket_id e tg_table_name):
-- quem está no ticket é avisado de que chegou um anexo novo.
create trigger broadcast_ticket_attachment
  after insert on public.ticket_attachments
  for each row execute function public.broadcast_ticket_message();

-- ============ STORAGE ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-attachments',
  'ticket-attachments',
  false,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Convenção de caminho: "<ticket_id>/<uuid>.<ext>"
create policy "ticket_attachments_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and exists (
      select 1 from public.tickets t
      where t.id::text = (storage.foldername(name))[1]
    )
  );

create policy "ticket_attachments_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ticket-attachments'
    and exists (
      select 1 from public.tickets t
      where t.id::text = (storage.foldername(name))[1]
        and t.status <> 'CLOSED'
        and (t.requester_id = (select auth.uid()) or (select public.is_agent()))
    )
  );

--   select o.name from storage.objects o
--   where o.bucket_id = 'ticket-attachments'
--     and not exists (select 1 from public.ticket_attachments a where a.storage_path = o.name);