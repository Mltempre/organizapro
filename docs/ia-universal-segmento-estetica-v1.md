# IA Universal — Homologação do Segmento: Estética

**Status:** implementado e testado, aguardando aprovação do Diretor. Segmento 9/13, template único. **Nenhum outro segmento tocado.**

---

## 1. Objetivo

Reconhecer perguntas sobre procedimentos estéticos (limpeza de pele, botox, preenchimento, peeling) a partir do que foi cadastrado — e, com atenção especial pedida pelo Diretor, **nunca diagnosticar tipo de pele/causa, nunca avaliar contraindicação e nunca garantir resultado**, sempre encaminhando para avaliação individual com a equipe.

## 2. Intenções específicas

| Intenção | Tipo | O que resolve |
|---|---|---|
| Limpeza de pele / Botox / Preenchimento / Peeling | Consulta dado real | Empresa oferece este procedimento? |
| Procedimentos (geral) | Consulta dado real (lista) | O que a empresa tem cadastrado |
| Diagnóstico estético | **Sempre escala** | Nunca classifica tipo de pele nem indica tratamento |
| Contraindicação estética | **Sempre escala** | Nunca avalia se o procedimento é seguro para a situação do cliente |
| Resultado garantido | **Sempre escala** | Nunca promete um resultado específico |

## 3. Vocabulário

`limpeza de pele`, `botox`, `preenchimento`, `peeling`, `procedimento`, `oleosa`, `pele seca`, `mancha`, `contraindicacao`, `garante o resultado`, `quantas sessoes`, `tipo de pele`, `qual tratamento`, `gravida`.

## 4. Exemplos

"fazem limpeza de pele?", "fazem botox?", "minha pele é oleosa ou seca? qual tratamento eu preciso?", "posso fazer botox grávida?", "isso garante o resultado? vai tirar todas as manchas?".

## 5. Respostas base

Consulta real: "Sim, fazemos X! Posso te ajudar a agendar [uma avaliação]." / honesto quando não cadastrado.
Diagnóstico (sempre): "Não posso avaliar seu tipo de pele ou indicar um tratamento por aqui — isso exige uma avaliação individual com a equipe. Posso te conectar?"
Contraindicação (sempre): "Não posso avaliar contraindicações por aqui — isso depende de uma avaliação individual com a equipe. Posso te conectar?"
Resultado garantido (sempre): "Resultados podem variar de pessoa para pessoa — não posso garantir um resultado específico por aqui. Recomendo uma avaliação individual com a equipe."

**Nota sobre "avaliação individual":** por pedido explícito do Diretor, as três respostas de escalonamento deste segmento reforçam consistentemente a mesma frase — "avaliação individual com a equipe" — em vez de cada uma inventar uma justificativa diferente.

## 6. Regras negativas

Nunca classifica tipo de pele, nunca aponta causa de uma mancha/condição, nunca confirma segurança de um procedimento numa situação específica (ex.: gravidez), nunca promete quantidade de sessões ou resultado — em nenhuma circunstância, independente de qualquer procedimento cadastrado.

## 7. Transferência

As três intenções "sempre escala" já são o próprio encaminhamento.

## 8. Casos de segurança

Nenhuma resposta cita o OrganizaPro; dado de uma empresa não vaza para outra (testado); isolamento confirmado com Pet Shop e Academia, nos dois sentidos.

## 9. Testes

`.scratch/test-ia-universal-estetica.ts` — **16 verificações, todas passando já na primeira execução** (nenhum bug novo — apliquei desde o início fragmentos curtos de vocabulário, já esperando a mesma armadilha de ordem de palavras dos segmentos anteriores).

**Regressão:** 187 testes anteriores + 16 novos = 203 no total, zero regressão.

## 10. Checklist de homologação

- [x] Arquitetura — nenhuma nova
- [x] Intenções específicas implementadas (4 de consulta + 1 de listagem + 3 de sempre-escalar)
- [x] Vocabulário técnico
- [x] Casos negativos cobertos (diagnóstico, contraindicação, resultado garantido)
- [x] Cenários de transferência documentados
- [x] Testes positivos e negativos passando (16/16)
- [x] Isolamento de vocabulário validado
- [x] `tsc --noEmit` e `next build` limpos, zero regressão
- [ ] Aprovação do Diretor — **pendente**
