# Pesquisa de Preços V1

## Escopo

Registra preços observados manualmente ou por fontes autorizadas e rastreáveis. Não faz scraping, não promete cobertura da internet e não altera preços de venda.

## Fonte da verdade

- `pesquisa_preco_itens`: identidade do item pesquisado e unidade canônica.
- `pesquisa_preco_fontes`: fornecedor/estabelecimento e proveniência.
- `pesquisa_preco_observacoes`: fatos históricos imutáveis.

Uma correção insere nova observação com `corrige_observacao_id`. O registro anterior permanece legível.

## Comparabilidade

O motor puro `lib/pesquisa-precos.ts` normaliza apenas conversões explícitas dentro da mesma dimensão: `g/kg`, `ml/l` e `cm/m`. `un`, `caixa` e `pacote` só são comparáveis com o mesmo tipo; o sistema não adivinha quantas unidades existem numa embalagem. Moedas diferentes não recebem conversão implícita.

Uma observação com unidade incompatível continua no histórico, marcada como não comparável. Dados com mais de 30 dias são sinalizados como antigos. Uma comparação de mercado exige duas fontes distintas atuais.

## Segurança

As APIs derivam o tenant da sessão e falham quando há zero ou mais de um vínculo ativo. `clinica_id` não faz parte dos contratos HTTP. A migration não concede acesso a `anon`; `authenticated` tem somente leitura protegida por vínculo ativo e `clinicas.produto = 'organizapro'`. Escritas passam pelo backend e os triggers validam todos os vínculos cross-tenant.

## Integrações futuras

- Catálogo: `servico_id` opcional permite associação comprovável, sem alterar `preco_centavos`.
- Smart Commerce: só considerar uma recomendação de revisão depois que existir contrato canônico e houver duas ou mais fontes atuais comparáveis.
- Pedidos e orçamentos: nenhuma criação ou alteração automática. Cotação de fornecedor, orçamento para cliente e pedido são fatos diferentes.
- Oportunidades: `oportunidades_demanda` não representa pesquisa de mercado e não é reutilizada.

## Convergência

A rota `/pesquisa-precos` funciona diretamente. A entrada em `AdminShellFrame.tsx` foi deliberadamente deixada para a convergência final, evitando colisão com a frente paralela do Capitão.
