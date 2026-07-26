# IA Universal — Homologação do Segmento: [Nome do Segmento]

**Status:** [em desenvolvimento / implementado, aguardando aprovação / homologado].

Template único de documentação para os 13 segmentos da Fase 3 (decisão do Diretor, 2026-07-25) — mesma estrutura para todos, para facilitar manutenção, revisão e expansão futura. Preencher as 10 seções abaixo para cada segmento, nesta ordem, sempre reaproveitando a Biblioteca Mestre (`docs/ia-universal-biblioteca-treinamentos-v1.md`) e nunca duplicando o que já é universal.

---

## 1. Objetivo

Uma frase: o que este módulo ensina a IA Universal a reconhecer para este segmento, e o que ele explicitamente **não** tenta fazer (ex.: nunca diagnosticar, nunca orçar, nunca prometer prazo).

## 2. Intenções específicas

Lista das intenções que só existem para este segmento (além das 16 universais já cobertas pela Biblioteca Mestre). Para cada uma: nome, o que ela resolve, e se ela é do tipo "consulta dado real" (usa `respostaDisponibilidadeServico` ou equivalente) ou do tipo "sempre escala" (nunca tenta responder sozinha, por ser um risco — ex.: diagnóstico técnico).

## 3. Vocabulário

Lista de termos (`vocabularioReconhecido`) que ativam o módulo. Só vocabulário real do segmento — nada que pertença à Camada 1 (universal) nem a outro segmento.

## 4. Exemplos

Por intenção específica, exemplos reais de frase (mesmo espírito da Biblioteca Mestre: formal, informal, gíria, erro comum, emoji quando fizer sentido).

## 5. Respostas base

Resposta padrão de cada intenção específica quando o dado existe (resposta afirmativa) e quando não existe (resposta honesta de "não confirmado"). Nunca menciona outro segmento, nunca menciona o OrganizaPro.

## 6. Regras negativas

O que este segmento **nunca** deve afirmar sem dado real — e, quando aplicável, o que ele nunca deve tentar responder de jeito nenhum (ex.: diagnóstico, orçamento fechado, prazo de entrega), mesmo que pareça óbvio.

## 7. Transferência

Cenários específicos deste segmento que sempre encaminham para humano, além dos 8 já cobertos pela Biblioteca Mestre.

## 8. Casos de segurança

Confirmação de que: (a) nenhuma resposta cita o OrganizaPro; (b) nenhuma resposta vaza dado de outra empresa; (c) vocabulário deste segmento não é reconhecido por outros módulos, e vice-versa.

## 9. Testes

Lista do que foi testado e o resultado (positivo, negativo, isolamento, segurança) — sempre em `.scratch/test-ia-universal-<segmento>.ts`, mais a re-execução da suite geral da Fase 1 para confirmar zero regressão.

## 10. Checklist de homologação

- [ ] Arquitetura (se houve alguma decisão nova de dado/Camada 3)
- [ ] Intenções específicas implementadas
- [ ] Vocabulário técnico do segmento
- [ ] Casos negativos cobertos
- [ ] Cenários de transferência documentados
- [ ] Testes positivos e negativos passando
- [ ] Isolamento de vocabulário validado (não vaza para outros segmentos, nem recebe vazamento)
- [ ] `tsc --noEmit` e `next build` limpos, sem regressão na suite geral
- [ ] Aprovação do Diretor
