-- FUTURO FIX - NAO EXECUTAR SEM GO E PRE-FLIGHT SALVO.
-- A criacao pode continuar pelo contrato existente. Transicao de estado fica
-- exclusivamente na RPC server-side; authenticated conserva somente leitura.

begin;

do $$
begin
  if to_regclass('public.oportunidades_demanda') is null then
    raise exception 'oportunidades_demanda ausente';
  end if;
  if to_regprocedure('public.transicionar_oportunidade_demanda_v1(uuid,uuid,text,text,jsonb)') is null then
    raise exception 'RPC governada ausente';
  end if;
end $$;

drop policy if exists oportunidades_demanda_update_own
  on public.oportunidades_demanda;

revoke update on public.oportunidades_demanda from public, anon, authenticated;

revoke all on function public.transicionar_oportunidade_demanda_v1(uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.transicionar_oportunidade_demanda_v1(uuid, uuid, text, text, jsonb)
  to service_role;

commit;

-- Rollback futuro depende do snapshot de grants/policies salvo no pre-flight.
-- Nao ha rollback generico seguro: recriar UPDATE para authenticated sem saber
-- o estado anterior reabre exatamente o caminho de contorno que este fix fecha.
