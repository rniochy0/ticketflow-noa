-- Agregação do dashboard feita na BD (GROUP BY), numa só chamada.
-- Alternativa rejeitada: buscar as linhas e contar em JS — o PostgREST corta
-- silenciosamente respostas acima de 1000 linhas e os números ficariam errados.
--
-- security invoker (por defeito): corre com as permissões de quem chama,
-- por isso o RLS de tickets continua a aplicar-se. Mesmo assim, há um guard
-- explícito: só staff (TECHNICIAN/MANAGER/ADMIN) pode pedir estatísticas globais.
create or replace function public.dashboard_stats(p_since timestamptz)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_staff() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total', (
      select count(*) from public.tickets where created_at >= p_since
    ),
    'by_status', coalesce((
      select jsonb_object_agg(status, c) from (
        select status::text as status, count(*) as c
        from public.tickets
        where created_at >= p_since
        group by status
      ) s
    ), '{}'::jsonb),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'count', c) order by c desc, name) from (
        select cat.name, count(*) as c
        from public.tickets t
        join public.categories cat on cat.id = t.category_id
        where t.created_at >= p_since
        group by cat.name
      ) x
    ), '[]'::jsonb),
    'by_site', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'count', c) order by c desc, name) from (
        select st.name, count(*) as c
        from public.tickets t
        join public.stores st on st.id = t.store_id
        where t.created_at >= p_since
        group by st.name
      ) x
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.dashboard_stats(timestamptz) from public, anon;
grant execute on function public.dashboard_stats(timestamptz) to authenticated;
