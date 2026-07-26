# IA Universal — Homologação do Segmento: Advogado

**Status:** implementado e testado, aguardando aprovação do Diretor. Segmento 5/13, template único. **Nenhum outro segmento tocado.**

---

## 1. Objetivo

Reconhecer perguntas sobre áreas de atuação do escritório e disponibilidade de consulta inicial a partir do que foi cadastrado — e, com a maior disciplina de todos os segmentos até agora, **nunca dar parecer jurídico** (opinião sobre chance de ganhar, se algo é crime, o que fazer numa situação) nem **prometer prazo processual**, mesmo que o cliente pergunte diretamente e o caso pareça simples. Isso está alinhado ao próprio limite já definido no documento de arquitetura da IA Universal: "não substitui decisão humana... não dá parecer técnico".

## 2. Intenções específicas

| Intenção | Tipo | O que resolve |
|---|---|---|
| Áreas de atuação | Consulta dado real (lista) | Em quais áreas o escritório atua |
| Consulta inicial | Consulta dado real | Escritório oferece consulta inicial gratuita? |
| Parecer jurídico | **Sempre escala** | Nunca avalia chance de ganhar, se algo é crime, ou orienta juridicamente |
| Prazo processual | **Sempre escala** | Nunca estima duração de um processo |

## 3. Vocabulário

`area de atuacao`, `areas`, `consulta inicial`, `processo`, `honorarios`, `chance`, `e crime`, `posso processar`, `meu caso`, `advogado`.

## 4. Exemplos

"quais áreas vocês atendem?", "tem consulta inicial gratuita?", "qual a chance de eu ganhar esse processo?", "isso que meu vizinho fez é crime?", "quanto tempo demora um processo desse tipo?".

## 5. Respostas base

Áreas de atuação: "Atuamos em: [lista real]. Posso te ajudar com mais alguma coisa?" / honesto quando vazio.
Consulta inicial: "Sim, oferecemos consulta inicial! ..." / "Não confirmado, mas posso confirmar com a equipe."
Parecer jurídico (sempre): "Não posso dar uma opinião jurídica por aqui — isso exige análise do seu caso específico. Posso te conectar com a equipe para uma avaliação correta?"
Prazo processual (sempre): "O prazo de um processo depende de vários fatores específicos do caso — posso confirmar isso com a equipe para você."

## 6. Regras negativas

Nunca confirma chance de sucesso de um caso, nunca classifica algo como crime/ilegal, nunca estima prazo de processo — em nenhuma circunstância, independente de qualquer dado cadastrado (diferente das outras intenções, estas duas **nunca** consultam `dados.servicos`).

## 7. Transferência

As duas intenções "sempre escala" já são o próprio encaminhamento — mesmo padrão da Oficina (diagnóstico/prazo) e do Restaurante/Pet Shop.

## 8. Casos de segurança

Nenhuma resposta cita o OrganizaPro; isolamento confirmado com Pet Shop e Oficina, nos dois sentidos.

## 9. Testes

`.scratch/test-ia-universal-advogado.ts` — 13 verificações, todas passando após correção de 2 bugs (ver abaixo). Regressão completa sem falhas.

### Bugs encontrados e corrigidos

1. **Vocabulário-gatilho não cobria "quais áreas vocês atendem?"** — só tinha a frase composta `"area de atuacao"`, que não aparece nessa formulação. Acrescentei o fragmento curto `"areas"`.
2. **Frase de exemplo com uma palavra a mais que o real:** meu exemplo `"chance de ganhar"` não batia com a pergunta real `"qual a chance **de eu** ganhar"` — a mesma lição já registrada nos segmentos anteriores (ordem/inserção de palavras quebra frase fixa). Troquei por fragmento curto `"chance"`.

## 10. Checklist de homologação

- [x] Arquitetura — nenhuma nova
- [x] Intenções específicas implementadas (2 de consulta + 2 de sempre-escalar)
- [x] Vocabulário técnico
- [x] Casos negativos cobertos (parecer jurídico e prazo, nunca respondidos)
- [x] Cenários de transferência documentados
- [x] Testes positivos e negativos passando (13/13)
- [x] Isolamento de vocabulário validado
- [x] `tsc --noEmit` e `next build` limpos, zero regressão
- [ ] Aprovação do Diretor — **pendente**
