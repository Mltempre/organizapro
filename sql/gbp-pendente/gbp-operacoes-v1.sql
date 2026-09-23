-- PENDENTE / REVISAO MANUAL. NAO EXECUTADO. Fora do runner de migrations.
-- Preflight autorizado: confirmar clinicas(id UUID), eventos_dominio e seus
-- campos abaixo, entidade_id UUID, grants/RLS e unicidade de idempotencia.
-- Nao aplicar junto de outros SQLs pendentes. Sem alteracao dos seis bloqueadores.
begin;
create table public.google_business_profile_operacoes (
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  operacao text not null check (operacao in ('oauth','rascunho','resposta','post')),
  chave text not null check (length(chave) between 1 and 128),
  recurso text not null,
  hash_pedido text not null,
  ticket uuid not null default gen_random_uuid(),
  estado text not null check (estado in ('pendente','sucesso','falhou','incerto')),
  resultado jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default clock_timestamp(),
  primary key (clinica_id, operacao, chave)
);
-- Um recurso nao pode ter duas escritas em voo, nem repetir resultado incerto
-- com outra chave. Sem expiracao automatica: crash exige reconciliacao.
create unique index gbp_operacao_em_voo on public.google_business_profile_operacoes
  (clinica_id, operacao, recurso) where estado in ('pendente','incerto');
alter table public.google_business_profile_operacoes enable row level security;
revoke all on public.google_business_profile_operacoes from public, anon, authenticated;
grant select, insert, update on public.google_business_profile_operacoes to service_role;

create function public.gbp_iniciar_operacao(p_clinica uuid, p_operacao text, p_chave text, p_recurso text, p_hash text)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare registro public.google_business_profile_operacoes%rowtype;
begin
  begin
    insert into public.google_business_profile_operacoes (clinica_id,operacao,chave,recurso,hash_pedido,estado)
    values (p_clinica,p_operacao,p_chave,p_recurso,p_hash,'pendente') returning * into registro;
    return jsonb_build_object('estado','adquirido','ticket',registro.ticket);
  exception when unique_violation then null;
  end;
  select * into registro from public.google_business_profile_operacoes
    where clinica_id=p_clinica and operacao=p_operacao and chave=p_chave for update;
  if not found then return jsonb_build_object('estado','pendente'); end if;
  if registro.recurso <> p_recurso or registro.hash_pedido <> p_hash then
    return jsonb_build_object('estado','conflito');
  end if;
  if registro.estado='sucesso' then return jsonb_build_object('estado','sucesso','resultado',registro.resultado); end if;
  if registro.estado='falhou' and p_operacao <> 'oauth' then
    begin
      update public.google_business_profile_operacoes set estado='pendente', ticket=gen_random_uuid(), atualizado_em=clock_timestamp()
        where clinica_id=p_clinica and operacao=p_operacao and chave=p_chave returning * into registro;
      return jsonb_build_object('estado','adquirido','ticket',registro.ticket);
    exception when unique_violation then return jsonb_build_object('estado','pendente'); end;
  end if;
  return jsonb_build_object('estado','pendente');
end $$;

create function public.gbp_finalizar_operacao(p_clinica uuid, p_operacao text, p_chave text, p_ticket uuid,
  p_estado text, p_resultado jsonb, p_entidade uuid)
returns boolean language plpgsql security invoker set search_path = public, pg_temp as $$
declare registro public.google_business_profile_operacoes%rowtype; tipo_evento text;
begin
  if p_estado not in ('sucesso','falhou','incerto') then raise exception 'Estado GBP invalido'; end if;
  select * into registro from public.google_business_profile_operacoes
    where clinica_id=p_clinica and operacao=p_operacao and chave=p_chave and ticket=p_ticket and estado='pendente' for update;
  if not found then return false; end if;
  -- Sucesso/auditoria local sao atomicos. Falha aqui preserva pendente;
  -- nunca repete uma escrita Google cujo resultado possa ter ocorrido.
  if p_estado='sucesso' and p_operacao <> 'oauth' then
    tipo_evento := case p_operacao when 'rascunho' then 'gbp.resposta_rascunho'
      when 'resposta' then 'gbp.resposta_publicada' when 'post' then 'gbp.post_publicado' end;
    insert into public.eventos_dominio (clinica_id,tipo,entidade_tipo,entidade_id,chave_idempotencia,payload,criado_em)
    values (p_clinica,tipo_evento,case when p_operacao='post' then 'post_google' else 'avaliacao_google' end,
      p_entidade,'gbp:v2:'||p_operacao||':'||p_chave,p_resultado||jsonb_build_object('resultado','sucesso'),clock_timestamp());
  end if;
  update public.google_business_profile_operacoes set estado=p_estado, resultado=p_resultado, atualizado_em=clock_timestamp()
    where clinica_id=p_clinica and operacao=p_operacao and chave=p_chave and ticket=p_ticket;
  return true;
end $$;
revoke all on function public.gbp_iniciar_operacao(uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.gbp_finalizar_operacao(uuid,text,text,uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.gbp_iniciar_operacao(uuid,text,text,text,text) to service_role;
grant execute on function public.gbp_finalizar_operacao(uuid,text,text,uuid,text,jsonb,uuid) to service_role;
commit;
