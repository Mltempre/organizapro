-- ─────────────────────────────────────────────────────────────────────────────
-- SANEAMENTO PROPOSTO — resíduo de teste do dono no tenant OrganizaPro Oficial
-- (missão Última Milha Pré-venda, 2026-09-28). NÃO APLICADO. Exige GO.
--
-- O que remove (e SOMENTE isso):
--   • pacientes     d83a32a8-9a55-4fe1-9d88-c1505e695c9d — cadastro do próprio
--     dono criado em 2026-07-31 para testar confirmação por WhatsApp;
--   • agendamentos  9b3639b6-63b2-4d10-b9ce-3d1f0497f77c — "Reunião" de
--     2026-08-18 do mesmo teste (confirmado com "Sim").
--
-- Por quê: é o único "cliente" do tenant oficial e aparece como cliente real
-- em Clientes / Gerente Comercial AI durante demonstrações.
--
-- NÃO remove: as 2 oportunidades de contatos reais de terceiros
-- (oportunidades_demanda), leads/logs do chatbot, logs de WhatsApp, eventos,
-- configurações, Meta Ads — nada além das 2 linhas acima.
--
-- Dependências verificadas em 2026-09-28 (somente leitura): nenhuma coluna
-- *paciente_id / *cliente_id / *agendamento_id / entidade_id de nenhuma tabela
-- referencia estes dois ids.
--
-- Fail-closed: aborta sem alterar nada se qualquer linha não estiver
-- exatamente no estado esperado (tenant, existência, referência nova).
--
-- PRÉ-CHECK (somente leitura) — esperado: 1 | 1
--   select (select count(*) from public.pacientes
--            where id = 'd83a32a8-9a55-4fe1-9d88-c1505e695c9d'
--              and clinica_id = '9b21a735-4bbb-4cbc-8666-7d941be9d35c') as paciente,
--          (select count(*) from public.agendamentos
--            where id = '9b3639b6-63b2-4d10-b9ce-3d1f0497f77c'
--              and clinica_id = '9b21a735-4bbb-4cbc-8666-7d941be9d35c') as agendamento;
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  tenant constant uuid := '9b21a735-4bbb-4cbc-8666-7d941be9d35c';
  pac    constant uuid := 'd83a32a8-9a55-4fe1-9d88-c1505e695c9d';
  ag     constant uuid := '9b3639b6-63b2-4d10-b9ce-3d1f0497f77c';
  n integer;
begin
  select count(*) into n from public.pacientes where id = pac and clinica_id = tenant;
  if n <> 1 then raise exception 'ABORTADO: paciente de teste não encontrado no tenant oficial (%). Nada alterado.', n; end if;
  select count(*) into n from public.agendamentos where id = ag and clinica_id = tenant;
  if n <> 1 then raise exception 'ABORTADO: agendamento de teste não encontrado no tenant oficial (%). Nada alterado.', n; end if;
  select count(*) into n from public.agendamentos where paciente_id = pac;
  if n <> 0 then raise exception 'ABORTADO: paciente passou a ter agendamento vinculado (%). Nada alterado.', n; end if;

  delete from public.agendamentos where id = ag and clinica_id = tenant;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'ABORTADO: agendamento removido % vezes. Nada alterado.', n; end if;

  delete from public.pacientes where id = pac and clinica_id = tenant;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'ABORTADO: paciente removido % vezes. Nada alterado.', n; end if;
end $$;

commit;

-- VERIFICAÇÃO (somente leitura) — esperado: 0 | 0
--   select (select count(*) from public.pacientes where id = 'd83a32a8-9a55-4fe1-9d88-c1505e695c9d') as paciente,
--          (select count(*) from public.agendamentos where id = '9b3639b6-63b2-4d10-b9ce-3d1f0497f77c') as agendamento;
