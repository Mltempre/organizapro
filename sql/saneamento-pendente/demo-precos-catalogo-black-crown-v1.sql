-- ─────────────────────────────────────────────────────────────────────────────
-- SEED DE DEMONSTRAÇÃO PROPOSTO — preços do catálogo do tenant demo
-- "Barbearia Black Crown" (missão Última Milha Pré-venda, 2026-09-28).
-- NÃO APLICADO. Exige GO. Não é correção de código: é DADO de demonstração.
--
-- Por quê: os 4 serviços do catálogo demo existem, mas estão sem preço
-- (preco_centavos NULL). Em Pedidos → Novo pedido eles aparecem como
-- "(sem preço)" e não podem ser selecionados — a demonstração do E-commerce
-- IA (pedido a partir do catálogo) fica impossível.
--
-- O que faz: preenche preco_centavos SOMENTE destes 4 serviços, SOMENTE no
-- tenant demo e SOMENTE onde o preço ainda é NULL (nunca sobrescreve preço já
-- definido). Valores fictícios de demonstração. Não cria, não apaga nada.
--
-- PRÉ-CHECK (somente leitura) — esperado: 4 linhas, preco_centavos NULL
--   select id, nome, preco_centavos from public.clinica_servicos
--    where clinica_id = 'ef8f75d9-e62a-43b4-b59f-b9093ce2495f' order by nome;
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  demo constant uuid := 'ef8f75d9-e62a-43b4-b59f-b9093ce2495f';
  n integer;
begin
  select count(*) into n from public.clinicas where id = demo and produto = 'organizapro' and nome = 'Barbearia Black Crown';
  if n <> 1 then raise exception 'ABORTADO: tenant demo não confere. Nada alterado.'; end if;

  update public.clinica_servicos s
     set preco_centavos = v.preco
    from (values
      ('6ae29a9b-4a67-46bb-aee6-b55fd304ddb5'::uuid, 4500),  -- Corte Masculino
      ('c6973a0a-0446-4027-aae0-65e36f6eb8eb'::uuid, 3500),  -- Barba
      ('87a8735e-2483-45f1-9dae-e1c583f66916'::uuid, 7000),  -- Combo Corte + Barba
      ('2093cb72-0ee7-4273-9776-62cbcd909369'::uuid, 6000)   -- Pigmentação de Barba
    ) as v(id, preco)
   where s.id = v.id and s.clinica_id = demo and s.preco_centavos is null;
  get diagnostics n = row_count;
  if n > 4 then raise exception 'ABORTADO: % linhas afetadas (esperado até 4). Nada alterado.', n; end if;
  raise notice 'Serviços do catálogo demo precificados: %', n;
end $$;

commit;

-- VERIFICAÇÃO (somente leitura) — esperado: 4 linhas com preço
--   select nome, preco_centavos from public.clinica_servicos
--    where clinica_id = 'ef8f75d9-e62a-43b4-b59f-b9093ce2495f' order by nome;
