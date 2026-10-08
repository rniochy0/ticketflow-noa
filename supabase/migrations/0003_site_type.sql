-- Resolve "sede e logística não são lojas": adiciona um tipo ao site,
-- sem renomear a tabela (evitava reescrever RLS, triggers e todo o código já feito).
create type public.site_type as enum ('STORE', 'HQ', 'LOGISTICS', 'OTHER');

alter table public.stores
  add column type public.site_type not null default 'STORE';

-- As 11 lojas do seed inicial ficam explicitamente como STORE
update public.stores set type = 'STORE' where type is null;

create index on public.stores (type);