-- ============ ENUMS ============
create type public.user_role as enum ('COLLABORATOR', 'TECHNICIAN', 'MANAGER', 'ADMIN');

-- ============ UTILITÁRIOS ============
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============ TABELAS ============
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 2 and 20),
  name text not null unique check (char_length(name) between 2 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, name)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  email text not null,
  department_id uuid references public.departments(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  job_title text check (char_length(job_title) <= 100),
  role public.user_role not null default 'COLLABORATOR',
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ INDEXES ============
create index on public.subcategories (category_id);
create index on public.profiles (department_id);
create index on public.profiles (store_id);
create index on public.profiles (role);

-- ============ TRIGGERS updated_at ============
create trigger set_updated_at before update on public.departments
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.stores
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.subcategories
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============ FUNÇÕES DE ROLE (usadas pelo RLS) ============
-- security definer evita recursão infinita ao consultar profiles dentro de policies
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles
  where id = (select auth.uid()) and is_active
$$;

create or replace function public.is_staff()
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
  select coalesce(public.current_user_role() = 'ADMIN', false)
$$;

revoke all on function public.current_user_role() from public, anon;
revoke all on function public.is_staff() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ============ PROFILE AUTOMÁTICO AO CRIAR UTILIZADOR ============
-- O role nunca vem dos metadados: começa sempre como COLLABORATOR
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ ANTI ESCALADA DE PRIVILÉGIOS ============
-- Um colaborador pode editar o próprio perfil, mas não o seu role, email, loja, etc.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- auth.uid() nulo = SQL Editor / service role (contexto de confiança)
  if (select auth.uid()) is not null and not public.is_admin() then
    if new.id is distinct from old.id
       or new.email is distinct from old.email
       or new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.department_id is distinct from old.department_id
       or new.store_id is distinct from old.store_id then
      raise exception 'Alteração não permitida a campos protegidos do perfil'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ============ RLS ============
alter table public.departments enable row level security;
alter table public.stores enable row level security;
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.profiles enable row level security;

-- Tabelas de referência: todos os autenticados lêem, só ADMIN escreve
create policy "departments_read" on public.departments
  for select to authenticated using (true);
create policy "departments_admin_write" on public.departments
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "stores_read" on public.stores
  for select to authenticated using (true);
create policy "stores_admin_write" on public.stores
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "categories_read" on public.categories
  for select to authenticated using (true);
create policy "categories_admin_write" on public.categories
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "subcategories_read" on public.subcategories
  for select to authenticated using (true);
create policy "subcategories_admin_write" on public.subcategories
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Profiles: cada um vê o seu; equipa (IT/gestor/admin) vê todos
create policy "profiles_read_own_or_staff" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));

create policy "profiles_update_own_or_admin" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));
-- Sem policy de INSERT/DELETE: só o trigger e a Auth Admin API criam/apagam perfis

-- Defesa em profundidade: o role anónimo não toca nestas tabelas
revoke all on public.departments, public.stores, public.categories,
  public.subcategories, public.profiles from anon;

-- ============ SEED ============
-- Nomes provisórios: substitui pelos nomes reais das lojas
insert into public.stores (code, name)
select 'L' || lpad(n::text, 2, '0'), 'Loja ' || lpad(n::text, 2, '0')
from generate_series(1, 11) as n;

insert into public.categories (name) values
  ('Computador'), ('Impressora'), ('Rede'), ('Email'),
  ('Acessos'), ('Sistemas'), ('Equipamentos'), ('Outros');