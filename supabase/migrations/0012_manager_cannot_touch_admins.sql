-- O GESTOR não pode alterar administradores nem criar/promover administradores.
-- (0011 deu-lhe os privilégios do admin; esta regra é a exceção.)
--
-- Barreira final na base de dados: mesmo que alguém contorne a aplicação,
-- um gestor autenticado não consegue editar uma linha cujo perfil seja ADMIN,
-- nem pôr o perfil ADMIN em ninguém (nem em si próprio).
-- Contexto de confiança (SQL Editor / secret key, auth.uid() nulo) não é afetado.

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if public.current_user_role() = 'MANAGER'
       and (old.role = 'ADMIN' or new.role = 'ADMIN') then
      raise exception 'Um gestor não pode alterar nem criar administradores'
        using errcode = '42501';
    end if;

    -- Quem não é admin/gestor só mexe nos campos não protegidos do próprio perfil
    if not public.is_admin() then
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
  end if;
  return new;
end;
$$;
