-- APOSENTADO / HOLD PERMANENTE.
--
-- Este arquivo criava SELECT publico amplo em public.clinicas para qualquer
-- linha com slug. O site atual usa public.site_publico_por_slug_v2, com slug e
-- produto literal, e nao precisa dessa policy para funcionar.
--
-- Mantemos o caminho/arquivo para preservar o historico e impedir que uma
-- instrucao antiga de operacao resulte em exposicao acidental. A execucao
-- aborta de forma explicita e nao altera schema, dados, grants ou policies.

do $$
begin
  raise exception
    'SQL aposentado: nao liberar SELECT publico em public.clinicas. Audite site_publico_por_slug_v2.';
end $$;
