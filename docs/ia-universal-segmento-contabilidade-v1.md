# IA Universal — Homologação do Segmento: Contabilidade

**Status:** implementado e testado, aguardando aprovação do Diretor. Segmento 7/13, template único. **Nenhum outro segmento tocado.**

---

## 1. Objetivo

Reconhecer perguntas sobre serviços contábeis (abertura de MEI/empresa, declaração de IR, folha de pagamento) a partir do que foi cadastrado — e nunca dar orientação fiscal específica (quanto vou pagar de imposto, qual regime tributário é melhor) nem prometer prazo de declaração, mesmo que pareça uma dúvida simples.

## 2. Intenções específicas

| Intenção | Tipo | O que resolve |
|---|---|---|
| Abertura de empresa/MEI / Declaração de IR / Folha de pagamento | Consulta dado real | Empresa oferece este serviço? |
| Orientação fiscal específica | **Sempre escala** | Nunca estima imposto a pagar nem indica regime tributário |
| Prazo de declaração | **Sempre escala** | Nunca promete uma data específica |

## 3. Vocabulário

`mei`, `declaracao de ir`, `declarar`, `imposto de renda`, `abertura de empresa`, `folha de pagamento`, `regime tributario`, `sonegacao`, `quanto vou pagar de imposto`, `prazo da declaracao`, `contador`.

## 4. Exemplos

"vocês abrem MEI?", "fazem folha de pagamento?", "quanto vou pagar de imposto esse ano?", "qual regime tributário é melhor pra mim?", "até quando posso declarar o IR?".

## 5. Respostas base

Consulta real: "Sim, [fazemos/cuidamos de] X! ..." / "Não confirmado, mas posso confirmar com a equipe."
Orientação fiscal (sempre): "Não posso dar uma orientação fiscal específica por aqui — isso depende da análise do seu caso. Posso te conectar com a equipe para uma avaliação correta?"
Prazo (sempre): "O prazo pode variar conforme o ano e sua situação — posso confirmar isso com a equipe para você."

## 6. Regras negativas

Nunca estima valor de imposto a pagar, nunca recomenda regime tributário, nunca promete data de prazo — independente de qualquer serviço cadastrado.

## 7. Transferência

As duas intenções "sempre escala" já são o próprio encaminhamento.

## 8. Casos de segurança

Nenhuma resposta cita o OrganizaPro; dado de uma empresa não vaza para outra (testado); isolamento confirmado com Pet Shop, Imobiliária e Restaurante.

## 9. Testes

`.scratch/test-ia-universal-contabilidade.ts` — 14 verificações, todas passando após correção de 1 bug.

### Bug encontrado e corrigido

**Vocabulário-gatilho não cobria "até quando posso declarar o IR?"** — só tinha as frases compostas `"declaracao de ir"` e `"prazo da declaracao"`, nenhuma presente nessa formulação (e evitei de propósito o termo solto `"ir"`, que em português também é o verbo "ir a algum lugar" — ambíguo demais). Acrescentei o fragmento `"declarar"` (verbo específico o suficiente no contexto contábil) ao vocabulário do módulo e à intenção de prazo.

## 10. Checklist de homologação

- [x] Arquitetura — nenhuma nova
- [x] Intenções específicas implementadas (3 de consulta + 2 de sempre-escalar)
- [x] Vocabulário técnico
- [x] Casos negativos cobertos
- [x] Cenários de transferência documentados
- [x] Testes positivos e negativos passando (14/14)
- [x] Isolamento de vocabulário validado
- [x] `tsc --noEmit` e `next build` limpos, zero regressão
- [ ] Aprovação do Diretor — **pendente**
