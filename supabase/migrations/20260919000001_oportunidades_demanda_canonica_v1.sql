-- Oportunidade Comercial Canônica V1.
-- Criar/validar em homologação antes de qualquer execução em produção.

ALTER TABLE public.oportunidades_demanda
  ADD COLUMN IF NOT EXISTS chave_idempotencia text,
  ADD COLUMN IF NOT EXISTS ultima_chave_idempotencia text,
  ADD COLUMN IF NOT EXISTS ultima_transicao_em timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS oportunidades_demanda_clinica_chave_uidx
  ON public.oportunidades_demanda (clinica_id, chave_idempotencia);

ALTER TABLE public.oportunidades_demanda ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS oportunidades_demanda_select_own ON public.oportunidades_demanda;
DROP POLICY IF EXISTS oportunidades_demanda_insert_own ON public.oportunidades_demanda;
DROP POLICY IF EXISTS oportunidades_demanda_update_own ON public.oportunidades_demanda;

CREATE POLICY oportunidades_demanda_select_own ON public.oportunidades_demanda
  FOR SELECT USING (clinica_id IN (SELECT clinica_id FROM public.clinica_usuarios WHERE usuario_id = auth.uid() AND ativo = true));
CREATE POLICY oportunidades_demanda_insert_own ON public.oportunidades_demanda
  FOR INSERT WITH CHECK (clinica_id IN (SELECT clinica_id FROM public.clinica_usuarios WHERE usuario_id = auth.uid() AND ativo = true));
CREATE POLICY oportunidades_demanda_update_own ON public.oportunidades_demanda
  FOR UPDATE USING (clinica_id IN (SELECT clinica_id FROM public.clinica_usuarios WHERE usuario_id = auth.uid() AND ativo = true))
  WITH CHECK (clinica_id IN (SELECT clinica_id FROM public.clinica_usuarios WHERE usuario_id = auth.uid() AND ativo = true));

CREATE OR REPLACE FUNCTION public.transicionar_oportunidade_demanda_v1(
  p_id uuid,
  p_clinica_id uuid,
  p_status text,
  p_chave_idempotencia text,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  atual public.oportunidades_demanda%ROWTYPE;
  permitido boolean;
  evento jsonb;
BEGIN
  SELECT * INTO atual FROM public.oportunidades_demanda
    WHERE id = p_id AND clinica_id = p_clinica_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'oportunidade não encontrada'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(atual.jornada) item WHERE item->>'chave_idempotencia' = p_chave_idempotencia) THEN
    RETURN to_jsonb(atual);
  END IF;
  permitido := CASE atual.status
    WHEN 'sinalizada' THEN p_status IN ('em_contato','perdida','expirada')
    WHEN 'em_contato' THEN p_status IN ('agendada','perdida','expirada')
    WHEN 'agendada' THEN p_status IN ('atendida','perdida','expirada')
    WHEN 'atendida' THEN p_status IN ('convertida','perdida')
    ELSE false
  END;
  IF NOT permitido THEN RAISE EXCEPTION 'transição inválida: % -> %', atual.status, p_status; END IF;
  evento := jsonb_build_object('de', atual.status, 'para', p_status, 'chave_idempotencia', p_chave_idempotencia, 'payload', p_payload, 'em', now());
  UPDATE public.oportunidades_demanda SET status = p_status, jornada = atual.jornada || jsonb_build_array(evento), ultima_chave_idempotencia = p_chave_idempotencia, ultima_transicao_em = now(), atualizado_em = now(), ultima_interacao_em = now(), resolvido_em = CASE WHEN p_status IN ('convertida','perdida','expirada') THEN now() ELSE resolvido_em END WHERE id = p_id AND clinica_id = p_clinica_id;
  SELECT * INTO atual FROM public.oportunidades_demanda WHERE id = p_id AND clinica_id = p_clinica_id;
  RETURN to_jsonb(atual);
END;
$$;

REVOKE ALL ON FUNCTION public.transicionar_oportunidade_demanda_v1(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transicionar_oportunidade_demanda_v1(uuid, uuid, text, text, jsonb) TO service_role;