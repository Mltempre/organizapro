# IA Universal — Homologação do Segmento: Barbearia

**Status: ✅ HOMOLOGADO** (decisão do Diretor, 2026-07-25). Primeiro dos 13 segmentos da Fase 3. Reformatado para o template único de documentação (`docs/ia-universal-segmento-TEMPLATE.md`) — mesmo conteúdo já aprovado, apenas reorganizado.

---

## 1. Objetivo

Ensinar a IA Universal a reconhecer perguntas típicas de uma barbearia sobre serviços específicos (corte infantil, barba, sobrancelha, hidratação) e responder sempre a partir da lista real de serviços que a própria empresa cadastrou — nunca supondo o que uma barbearia oferece.

## 2. Intenções específicas

| Intenção | Tipo | O que resolve |
|---|---|---|
| Corte infantil | Consulta dado real | Empresa oferece corte para crianças? |
| Barba | Consulta dado real | Empresa oferece serviço de barba? |
| Sobrancelha | Consulta dado real | Empresa oferece design de sobrancelha? |
| Hidratação | Consulta dado real | Empresa oferece hidratação capilar? |

Todas do tipo "consulta dado real" — nenhuma "sempre escala" neste segmento (baixo risco: nenhuma delas envolve diagnóstico, orçamento fechado ou prazo).

## 3. Vocabulário

`corte`, `barba`, `cabelo`, `degrade`, `sobrancelha`, `hidratacao`, `penteado`, `navalha`, `pezinho`, `corte infantil`, e a gíria `nevou` (cliente usa para "ficou um degradê muito bem feito").

## 4. Exemplos

| Intenção | Exemplos reais |
|---|---|
| Corte infantil | "corte infantil", "corta cabelo de criança", "atende criança", "corte pra criança", "cortam cabelo de nenem", "corte kids", "vocês cortam infantil" |
| Barba | "fazem barba", "faz a barba", "corte e barba", "barba tbm", "vcs fazem barba", "tem serviço de barba", "barboterapia" |
| Sobrancelha | "fazem sobrancelha", "design de sobrancelha", "acerta a sobrancelha", "vcs fazem sobrancelha", "tem sobrancelha" |
| Hidratação | "fazem hidratação", "tem hidratação capilar", "hidrata o cabelo", "vcs hidratam", "tem hidratação" |

## 5. Respostas base

| Intenção | Se o serviço existe | Se não existe (ou não está confirmado) |
|---|---|---|
| Corte infantil | "Sim, fazemos corte infantil! Se quiser, posso te ajudar a agendar." | "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você." |
| Barba | "Sim, trabalhamos com barba! Posso te ajudar a agendar." | idem |
| Sobrancelha | "Sim, fazemos sobrancelha! Posso te ajudar a agendar." | idem |
| Hidratação | "Sim, temos hidratação! Posso te ajudar a agendar." | idem |

Nenhuma resposta menciona "barbearia" explicitamente nem o OrganizaPro.

## 6. Regras negativas

Serviço não cadastrado → resposta honesta de "não confirmado", nunca "não fazemos" (a empresa pode simplesmente não ter cadastrado ainda) e nunca uma afirmação de que sim sem o dado. Dado de serviços ainda não carregado (`servicos` undefined) → resolver devolve `null`, sistema atual assume — nunca arrisca.

## 7. Transferência

Nenhum cenário adicional além dos 8 já cobertos pela Biblioteca Mestre — este segmento não tem risco de diagnóstico/orçamento/prazo como uma oficina, por exemplo.

## 8. Casos de segurança

- Nenhuma resposta do módulo cita o OrganizaPro (testado).
- Duas empresas diferentes nunca compartilham resposta ou dado entre si (testado com dois tenants distintos).
- Vocabulário de barbearia não é reconhecido dentro do módulo de Oficina, e vice-versa (testado).

## 9. Testes

`.scratch/test-ia-universal-barbearia.ts` — 14 verificações: serviço cadastrado → resposta afirmativa; serviço não cadastrado → resposta honesta negativa; dado não carregado → `null`; isolamento entre tenants; isolamento entre segmentos; segurança comercial; intenções universais continuam funcionando com o módulo carregado. Suite geral da Fase 1 (55 verificações) + `tsc --noEmit` + `next build` re-executados sem regressão.

## 10. Checklist de homologação

- [x] Arquitetura (`DadosEmpresaUniversal.servicos`, de `clinica_servicos` — sem migração; helper `respostaDisponibilidadeServico` reutilizável)
- [x] Intenções específicas implementadas (4)
- [x] Vocabulário técnico do segmento
- [x] Casos negativos cobertos
- [x] Cenários de transferência documentados (nenhum adicional necessário)
- [x] Testes positivos e negativos passando (14/14)
- [x] Isolamento de vocabulário validado
- [x] `tsc --noEmit` e `next build` limpos, sem regressão na suite geral
- [x] Aprovação do Diretor — **HOMOLOGADO em 2026-07-25**
