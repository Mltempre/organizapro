# IA Universal — Homologação do Segmento: Academia

**Status:** implementado e testado, aguardando aprovação do Diretor. Segmento 8/13, template único. **Nenhum outro segmento tocado.**

---

## 1. Objetivo

Reconhecer perguntas sobre serviços da academia (aula experimental, musculação, personal, planos) a partir do que foi cadastrado — e, com atenção especial pedida pelo Diretor, **nunca avaliar lesão, nunca avaliar contraindicação, nunca recomendar suplementação e nunca prescrever treino**, mesmo que o cliente peça diretamente e a pergunta pareça simples.

## 2. Intenções específicas

| Intenção | Tipo | O que resolve |
|---|---|---|
| Aula experimental / Musculação / Personal | Consulta dado real | Empresa oferece este serviço? |
| Planos/matrícula | Consulta dado real (lista) | Quais planos existem |
| Lesão | **Sempre escala** | Nunca avalia se o cliente pode treinar machucado |
| Contraindicação | **Sempre escala** | Nunca avalia se é seguro treinar com uma condição de saúde |
| Suplementação | **Sempre escala** | Nunca recomenda suplemento, marca ou dosagem |
| Prescrição de treino | **Sempre escala** | Nunca monta ou detalha uma série/treino |

## 3. Vocabulário

`aula experimental`, `musculacao`, `personal`, `matricula`, `crossfit`, `lesao`, `machuquei`, `contraindicacao`, `pressao alta`, `suplemento`, `whey`, `creatina`, `monta um treino`, `qual treino`, `quantas series`, `prescricao`.

## 4. Exemplos

"tem aula experimental?", "tem musculação?", "machuquei o joelho, posso treinar assim mesmo?", "tenho pressão alta, posso treinar mesmo assim?", "qual creatina é melhor pra mim?", "monta um treino pra mim de hipertrofia".

## 5. Respostas base

Consulta real: "Sim, [temos/oferecemos] X! ..." / honesto quando não cadastrado.
Lesão (sempre): "Não posso avaliar lesões por aqui — recomendo conversar com um profissional antes de treinar. Posso te conectar com a equipe?"
Contraindicação (sempre): "Não posso avaliar contraindicações por aqui — isso depende de uma avaliação individual com um profissional. Posso te conectar com a equipe?"
Suplementação (sempre): "Não posso recomendar suplementação por aqui — isso exige orientação de um profissional. Posso te conectar com a equipe?"
Prescrição de treino (sempre): "Não posso montar ou prescrever um treino por aqui — isso precisa de avaliação de um profissional. Posso te conectar com a equipe?"

## 6. Regras negativas

Nunca avalia se um machucado permite treinar, nunca confirma segurança de treinar com uma condição de saúde, nunca recomenda suplemento/marca/dosagem, nunca monta séries/repetições — em nenhuma circunstância, independente de qualquer serviço cadastrado.

## 7. Transferência

As quatro intenções "sempre escala" já são o próprio encaminhamento.

## 8. Casos de segurança

Nenhuma resposta cita o OrganizaPro; isolamento confirmado com Barbearia, Contabilidade, Imobiliária e Restaurante (nos dois sentidos).

## 9. Testes

`.scratch/test-ia-universal-academia.ts` — 16 verificações, todas passando após 1 correção.

### Bug encontrado e corrigido

**"Tenho pressão alta, posso treinar mesmo assim?"** não batia com nenhuma das frases escritas para contraindicação (`"posso treinar mesmo com"`, `"tenho pressao alta posso treinar"`) — a pontuação e a ordem real da frase eram diferentes das que eu havia escrito. Acrescentei o fragmento curto e específico `"pressao alta"` (condição de saúde nomeada diretamente), mesma lição já recorrente nos segmentos anteriores.

**Regressão:** 187 testes anteriores + 16 novos = 203 no total, zero regressão.

## 10. Checklist de homologação

- [x] Arquitetura — nenhuma nova
- [x] Intenções específicas implementadas (4 de consulta + 4 de sempre-escalar)
- [x] Vocabulário técnico
- [x] Casos negativos cobertos (lesão, contraindicação, suplementação, prescrição)
- [x] Cenários de transferência documentados
- [x] Testes positivos e negativos passando (16/16)
- [x] Isolamento de vocabulário validado
- [x] `tsc --noEmit` e `next build` limpos, zero regressão
- [ ] Aprovação do Diretor — **pendente**
