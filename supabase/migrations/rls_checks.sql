-- ============================================================
-- Verificação de segurança (RLS) — NOA HelpDesk
-- Corre INTEIRO no SQL Editor do Supabase. No fim aparece uma tabela
-- com PASS / FAIL por teste. Não altera dados reais: cria um ticket de
-- teste (título RLS_TEST) e apaga-o no fim.
--
-- Pré-requisitos (utilizadores ATIVOS):
--   2 colaboradores, 1 técnico, 1 gestor e 1 administrador.
-- ============================================================
do $do$
declare
  a uuid; b uuid; tech uuid; mgr uuid; adm uuid;
  v_store uuid; v_cat uuid; tid uuid;
  v jsonb := '[]'::jsonb;
  ok boolean; n int;
begin
  -- escolhe utilizadores de teste (como postgres, sem RLS)
  select id into a    from public.profiles where role = 'COLLABORATOR' and is_active order by created_at limit 1;
  select id into b    from public.profiles where role = 'COLLABORATOR' and is_active order by created_at offset 1 limit 1;
  select id into tech from public.profiles where role = 'TECHNICIAN'   and is_active order by created_at limit 1;
  select id into mgr  from public.profiles where role = 'MANAGER'      and is_active order by created_at limit 1;
  select id into adm  from public.profiles where role = 'ADMIN'        and is_active order by created_at limit 1;
  select id into v_store from public.stores where is_active limit 1;
  select id into v_cat   from public.categories where is_active limit 1;

  if a is null or b is null or tech is null or mgr is null or adm is null then
    raise exception 'Faltam utilizadores ativos: precisas de 2 COLLABORATOR, 1 TECHNICIAN, 1 MANAGER e 1 ADMIN.';
  end if;

  -- ---------- como COLABORADOR A ----------
  perform set_config('request.jwt.claims', json_build_object('sub', a::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  execute 'set local role authenticated';

  insert into public.tickets (title, description, category_id, store_id, priority, requester_id)
  values ('RLS_TEST', 'ticket de teste de segurança', v_cat, v_store, 'MEDIUM', a)
  returning id into tid;
  insert into public.ticket_messages (ticket_id, author_id, body) values (tid, a, 'RLS_TEST msg');

  select count(*) into n from public.tickets where id = tid;
  v := v || jsonb_build_array(jsonb_build_object('t', 'A vê o próprio ticket', 'ok', n = 1));

  select count(*) into n from public.profiles;
  v := v || jsonb_build_array(jsonb_build_object('t', 'A só vê 1 perfil (o seu)', 'ok', n = 1));

  ok := false;
  begin update public.profiles set role = 'ADMIN' where id = a; get diagnostics n = row_count; ok := (n = 0);
  exception when others then ok := true; end;
  v := v || jsonb_build_array(jsonb_build_object('t', 'A não consegue promover-se a ADMIN', 'ok', ok));

  ok := false;
  begin update public.tickets set priority = 'URGENT' where id = tid; get diagnostics n = row_count; ok := (n = 0);
  exception when others then ok := true; end;
  v := v || jsonb_build_array(jsonb_build_object('t', 'A não altera a prioridade do ticket', 'ok', ok));

  ok := false;
  begin update public.tickets set assignee_id = a where id = tid; get diagnostics n = row_count; ok := (n = 0);
  exception when others then ok := true; end;
  v := v || jsonb_build_array(jsonb_build_object('t', 'A não se atribui o ticket', 'ok', ok));

  ok := false;
  begin
    insert into public.tickets (title, description, category_id, store_id, priority, requester_id)
    values ('RLS_TEST', 'em nome de outro', v_cat, v_store, 'LOW', b);
  exception when others then ok := true; end;
  v := v || jsonb_build_array(jsonb_build_object('t', 'A não abre ticket em nome de B', 'ok', ok));

  ok := false;
  begin perform public.dashboard_stats(now() - interval '30 days');
  exception when others then ok := true; end;
  v := v || jsonb_build_array(jsonb_build_object('t', 'A não acede às estatísticas globais', 'ok', ok));

  select count(*) into n from public.ticket_staff_emails(tid);
  v := v || jsonb_build_array(jsonb_build_object('t', 'A obtém os emails do IT do próprio ticket (para notificar)', 'ok', n > 0));

  -- ---------- como COLABORADOR B (sem relação com o ticket) ----------
  perform set_config('request.jwt.claims', json_build_object('sub', b::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.tickets where id = tid;
  v := v || jsonb_build_array(jsonb_build_object('t', 'B NÃO vê o ticket de A', 'ok', n = 0));

  select count(*) into n from public.ticket_messages where ticket_id = tid;
  v := v || jsonb_build_array(jsonb_build_object('t', 'B NÃO vê mensagens do ticket de A', 'ok', n = 0));

  select count(*) into n from public.ticket_events where ticket_id = tid;
  v := v || jsonb_build_array(jsonb_build_object('t', 'B NÃO vê o histórico do ticket de A', 'ok', n = 0));

  select count(*) into n from public.ticket_attachments where ticket_id = tid;
  v := v || jsonb_build_array(jsonb_build_object('t', 'B NÃO vê anexos do ticket de A', 'ok', n = 0));

  ok := false;
  begin insert into public.ticket_messages (ticket_id, author_id, body) values (tid, b, 'intruso');
  exception when others then ok := true; end;
  v := v || jsonb_build_array(jsonb_build_object('t', 'B NÃO escreve no ticket de A', 'ok', ok));

  select count(*) into n from public.ticket_staff_emails(tid);
  v := v || jsonb_build_array(jsonb_build_object('t', 'B NÃO obtém emails do IT via ticket de A', 'ok', n = 0));

  select count(*) into n from public.ticket_participants(tid);
  v := v || jsonb_build_array(jsonb_build_object('t', 'B NÃO obtém participantes do ticket de A', 'ok', n = 0));

  -- ---------- como TÉCNICO ----------
  perform set_config('request.jwt.claims', json_build_object('sub', tech::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', tech::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.tickets where id = tid;
  v := v || jsonb_build_array(jsonb_build_object('t', 'Técnico vê o ticket', 'ok', n = 1));

  ok := false;
  begin update public.tickets set title = 'alterado' where id = tid; get diagnostics n = row_count; ok := (n = 0);
  exception when others then ok := true; end;
  v := v || jsonb_build_array(jsonb_build_object('t', 'Técnico NÃO altera o título', 'ok', ok));

  ok := false;
  begin
    update public.tickets set assignee_id = tech, status = 'IN_PROGRESS' where id = tid and status = 'OPEN' and assignee_id is null;
    get diagnostics n = row_count; ok := (n = 1);
  exception when others then ok := false; end;
  v := v || jsonb_build_array(jsonb_build_object('t', 'Técnico assume ticket novo', 'ok', ok));

  ok := false;
  begin
    update public.tickets set assignee_id = tech, status = 'IN_PROGRESS' where id = tid and status = 'OPEN' and assignee_id is null;
    get diagnostics n = row_count; ok := (n = 0);
  exception when others then ok := true; end;
  v := v || jsonb_build_array(jsonb_build_object('t', 'Segundo "assumir" no mesmo ticket não faz nada', 'ok', ok));

  ok := false;
  begin update public.tickets set status = 'CLOSED' where id = tid; get diagnostics n = row_count; ok := (n = 0);
  exception when others then ok := true; end;
  v := v || jsonb_build_array(jsonb_build_object('t', 'Transição inválida IN_PROGRESS→CLOSED é recusada', 'ok', ok));

  -- ---------- como GESTOR ----------
  perform set_config('request.jwt.claims', json_build_object('sub', mgr::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', mgr::text, true);
  execute 'set local role authenticated';

  ok := false;
  begin update public.profiles set full_name = full_name where id = adm; get diagnostics n = row_count; ok := false;
  exception when others then ok := true; end;
  v := v || jsonb_build_array(jsonb_build_object('t', 'Gestor NÃO altera um administrador', 'ok', ok));

  ok := false;
  begin update public.profiles set role = 'ADMIN' where id = a; get diagnostics n = row_count; ok := (n = 0);
  exception when others then ok := true; end;
  v := v || jsonb_build_array(jsonb_build_object('t', 'Gestor NÃO promove ninguém a ADMIN', 'ok', ok));

  ok := false;
  begin update public.profiles set job_title = job_title where id = a; get diagnostics n = row_count; ok := (n = 1);
  exception when others then ok := false; end;
  v := v || jsonb_build_array(jsonb_build_object('t', 'Gestor edita um colaborador', 'ok', ok));

  -- ---------- como ADMIN ----------
  perform set_config('request.jwt.claims', json_build_object('sub', adm::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', adm::text, true);
  execute 'set local role authenticated';

  ok := false;
  begin update public.profiles set job_title = job_title where id = a; get diagnostics n = row_count; ok := (n = 1);
  exception when others then ok := false; end;
  v := v || jsonb_build_array(jsonb_build_object('t', 'Admin edita um colaborador', 'ok', ok));

  -- ---------- sem sessão (anon) ----------
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';

  ok := false;
  begin select count(*) into n from public.tickets; ok := (n = 0);
  exception when others then ok := true; end;
  v := v || jsonb_build_array(jsonb_build_object('t', 'Anónimo NÃO lê tickets', 'ok', ok));

  ok := false;
  begin select count(*) into n from public.profiles; ok := (n = 0);
  exception when others then ok := true; end;
  v := v || jsonb_build_array(jsonb_build_object('t', 'Anónimo NÃO lê perfis', 'ok', ok));

  -- ---------- volta a postgres: configuração e limpeza ----------
  execute 'reset role';

  select count(*) into n from pg_tables where schemaname = 'public' and not rowsecurity;
  v := v || jsonb_build_array(jsonb_build_object('t', 'Todas as tabelas public têm RLS ativo (' || n || ' sem RLS)', 'ok', n = 0));

  delete from public.tickets where title = 'RLS_TEST';  -- mensagens e histórico saem por cascade

  drop table if exists pg_temp.rls_results;
  create temp table rls_results as
    select row_number() over () as n,
           case when (e->>'ok')::boolean then 'PASS' else 'FAIL' end as resultado,
           e->>'t' as teste
    from jsonb_array_elements(v) as e;
end
$do$;

select * from rls_results order by n;
-- Esperado: tudo PASS. Qualquer FAIL é um problema de segurança a corrigir.

-- Para rever à mão as políticas de Storage (anexos):
-- select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'storage';
