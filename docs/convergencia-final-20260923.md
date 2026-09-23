# Convergência final local — 23/09/2026

Linha canônica: `convergencia/final-organizapro-v1`, partindo de `99ff7507c997fb101e6bcfc3b71d9fa15cd9d84b` (Contador v2). Um único checkpoint final; deltas aplicados sem commits intermediários.

## Entregas incorporadas

- Saneamento/GBP/segurança: `434bf3e`, `edc8475`, `1cf551f`, `14d67a5`, `4d8499f`.
- Gerente Comercial: `6bc2fd5`.
- Ads/Atribuição local: `21ab5f0`.
- Casa final: `abf180a`.
- Contador v1/v2 já presentes na base; preservados. Somente aprovação do envio contábil adaptada nesta convergência.

## Resoluções

- Dois trechos em conflito no Copiloto: tipo da oportunidade e adaptação dos sinais. Preservados canal/confiança vindos do registro real e incorporada a coordenação do Gerente. Teste de wiring atualizado para a projeção explícita existente, mantendo as duas verificações de proveniência.
- Migration Ads renomeada para `20260923000003_ads_atribuicao_v1.sql`. Contador conserva `20260923000001_fechamento_contabil_v1.sql` e `20260923000002_fechamento_contabil_v2.sql`. Referências locais de teste/documentação atualizadas; teste comprova versões únicas. Nenhuma migration executada. Histórico remoto não foi consultado; verificar antes de futura aplicação.
- Envio contábil usa `operacao` derivada no servidor por cliente/competência/dia e as funções existentes `reservarOperacao`/`finalizarOperacao`. Chave nova do navegador não libera duplicação. Rejeição comprovada antes do efeito permite retry com o mesmo conteúdo; timeout/resultado incerto/sucesso bloqueiam reenvio. Erro de persistência não vira sucesso. Falha na leitura das pendências, histórico ou consentimento bloqueia a ação.
- Não houve conflito textual nos demais deltas. Núcleo, UI e migrations do Contador v2 foram comparados com a base e preservados, salvo a rota de envio indicada.

## Validação

- Bateria local principal: 923 testes, inicialmente 917 aprovados, 5 skips externos e uma expectativa textual antiga do Gerente incompatível com a resolução escolhida. Corrigida somente essa expectativa; os 20 testes de Gerente/Copiloto passaram no reteste.
- Bateria server-only GBP: 31 aprovados.
- Resultado consolidado dos testes distintos: **949 aprovados, 5 skips externos previstos, zero falhas pendentes**. O reteste não é somado novamente ao total.
- Inclui 18 testes novos: rota contábil real até o adaptador WhatsApp real com transporte/banco isolados, concorrência, retry, consentimento, falha de leitura/persistência, separação de competências e unicidade de versões SQL.
- TypeScript completo: `tsc --noEmit --incremental false`, aprovado.
- ESLint completo: zero erros, 24 avisos preexistentes. Lint do teste ajustado também aprovado.
- `git diff --check` aprovado. Sem build pesado, instalação ou chamadas externas.

## Pendências preservadas

- Preflight remoto autorizado, contratos de banco/RLS/grants/storage, migrations e homologação ponta a ponta das integrações. SQLs de saneamento/GBP continuam fora do runner automático.
- Ads oficial/OAuth/custos/conversões permanece fora do V1 local, conforme auditoria; não foi criado.
- Delta opcional SEO/FAQ `8f85402` e apresentação alternativa `rei/dashboard-sites-v1` não integram a lista de entregas autorizadas para esta execução; branches preservadas.
- Nenhum push, deploy, merge remoto, Supabase real, WhatsApp real, OAuth ou produção. Não redesenhada a Casa, não introduzida funcionalidade comercial nova.

O SHA final e a confirmação do Git limpo são registrados no relatório de saída após o commit.
