# IA Universal — Homologação do Segmento: Restaurante

**Status:** implementado e testado, aguardando aprovação do Diretor. Segmento 3/13, seguindo o template único (`docs/ia-universal-segmento-TEMPLATE.md`). **Nenhum outro segmento foi tocado nesta entrega** — Barbearia e Oficina Mecânica permanecem exatamente como estavam.

---

## 1. Objetivo

Ensinar a IA Universal a reconhecer perguntas típicas de restaurante sobre cardápio (pratos, bebidas, sobremesas), delivery/retirada e "está aberto agora" — sempre a partir de dado real já cadastrado. E, com a mesma disciplina da Oficina em relação a diagnóstico/prazo, **nunca confirmar** taxa de entrega, área atendida, forma de pagamento, tempo de preparo ou disponibilidade de mesa, porque nenhuma dessas informações tem um campo de dado nesta fase — sempre encaminhar, nunca estimar.

## 2. Intenções específicas

| Intenção | Tipo | O que resolve |
|---|---|---|
| Cardápio/pratos | Consulta dado real (lista) | O que a empresa tem cadastrado como serviço/item |
| Bebidas | Consulta dado real (sim/não) | Empresa tem bebida cadastrada? |
| Sobremesas | Consulta dado real (sim/não) | Empresa tem sobremesa cadastrada? |
| Delivery | Consulta dado real (sim/não) | Empresa oferece entrega? |
| Retirada | Consulta dado real (sim/não) | Empresa oferece retirada no local? |
| Aberto agora | Consulta dado real (relay) | Reaproveita `dados.horario` — não inventa horário, só relaia o que já existe |
| Taxa de entrega | **Sempre escala** | Nenhum campo de taxa nesta fase |
| Área de atendimento | **Sempre escala** | Nenhum campo de cobertura geográfica nesta fase |
| Formas de pagamento | **Sempre escala** | Nenhum campo de forma de pagamento (proibido desde a Fase 1) |
| Tempo de preparo | **Sempre escala** | Nenhum campo de tempo de preparo nesta fase |
| Reserva de mesa | **Sempre escala** | Nenhum campo de disponibilidade de mesas nesta fase |

**Decisão de reaproveitamento importante:** "cardápio/pratos/bebidas/sobremesas" usam o **mesmo** `dados.servicos` (de `clinica_servicos`) que Barbearia e Oficina já usam — um restaurante cadastra itens de cardápio como "serviços", exatamente o mesmo conceito genérico. Nenhuma arquitetura nova. A única novidade de **apresentação** é que a intenção de cardápio lista os nomes reais em vez de responder só sim/não (ainda lendo só `dados.servicos`, nunca inventando um prato).

**Nota sobre "cancelamento":** não criei uma intenção específica para isso — "quero cancelar meu pedido" já é resolvido pela Camada 1 (`reagendar_cancelar`, universal), e checar isso primeiro é o comportamento correto: a Camada 1 é tentada antes da Camada 2 (ver seção 6 do documento de arquitetura), então este segmento não precisa reensinar algo que já é universal.

## 3. Vocabulário

`cardapio`, `prato do dia`, `marmita`, `bebida`, `sobremesa`, `delivery`, `entrega`, `retirada`, `taxa de entrega`, `area de entrega`, `reserva`, `mesa`, `pix`, `forma de pagamento`, `tempo de preparo`, `demora`, `aberto`, `vegetariano`, `vegano`.

## 4. Exemplos (incluindo os pedidos na missão)

| Intenção | Exemplos reais |
|---|---|
| Cardápio | "tem marmita hoje?", "qual o prato do dia?", "cardápio de hoje" |
| Bebidas | "tem bebida?", "tem refrigerante?", "tem suco?" |
| Sobremesas | "tem sobremesa?", "tem doce?" |
| Delivery | "faz entrega?", "tem delivery?" |
| Retirada | "fazem retirada?", "posso retirar?" |
| Taxa de entrega | "qual a taxa de entrega?", "quanto é o frete?" |
| Área de atendimento | "entrega aqui?", "entregam no meu bairro?" |
| Formas de pagamento | "aceita pix?", "aceita cartão?" |
| Tempo de preparo | "quanto tempo demora?" |
| Reserva de mesa | "tem mesa pra 4?" |
| Aberto agora | "aberto agora?", "vocês estão abertos agora?" |

## 5. Respostas base

| Intenção | Se o dado existe | Se não existe |
|---|---|---|
| Cardápio | "Hoje temos: [lista real]. Posso te ajudar com mais alguma coisa?" | "No momento não tenho o cardápio confirmado aqui, mas posso confirmar com a equipe para você." |
| Bebidas / Sobremesas / Delivery / Retirada | "Sim, [temos/fazemos] X! ..." | "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você." |
| Aberto agora | "Nosso horário de atendimento é: [horário real]. ..." | *(sem horário cadastrado, devolve `null` — sistema atual assume)* |
| Taxa de entrega / Área / Pagamento / Prazo / Mesa | *(sempre a mesma resposta de encaminhamento, independente de qualquer dado)* | idem |

Nenhuma resposta menciona "restaurante" explicitamente nem o OrganizaPro.

## 6. Regras negativas

Todas as 7 pedidas na missão, confirmadas por teste: nunca inventa item de cardápio, preço, tempo de preparo, taxa de entrega, área atendida, disponibilidade de mesa ou forma de pagamento. Quando falta o dado (ou o dado simplesmente não existe nesta fase, caso das 5 últimas), a resposta é sempre honesta + encaminhamento — nunca um "sim" ou um número inventado.

## 7. Transferência

Além dos 8 cenários da Biblioteca Mestre: as 5 intenções "sempre escala" já **são** o encaminhamento (mesmo padrão da Oficina) — não é um gatilho adicional, é a própria resposta.

## 8. Casos de segurança

- Nenhuma resposta cita o OrganizaPro (testado).
- Cardápio de uma empresa não aparece na resposta de outra empresa sem esse item (testado).
- Vocabulário de restaurante não é reconhecido por Barbearia nem por Oficina, e Restaurante não reconhece vocabulário de Barbearia nem de Oficina — **os 4 sentidos de isolamento pedidos, todos testados.**

## 9. Testes

`.scratch/test-ia-universal-restaurante.ts` — 22 verificações: cardápio/bebida/delivery cadastrados → afirmativo (com lista real no caso do cardápio); cardápio vazio/sobremesa não cadastrada → honesto, nunca inventa item; taxa/área/pagamento/prazo/mesa → sempre escala, nunca número ou "sim" inventado; "aberto agora" reaproveita `dados.horario` corretamente e devolve `null` quando não há horário; isolamento nos 4 sentidos (Restaurante×Barbearia, Restaurante×Oficina, e os dois inversos); segurança comercial; isolamento entre tenants; universal (endereço) continua funcionando.

**Regressão:** suite da Fase 1 (55) + Barbearia (14) + Oficina (18) re-executadas — **109 testes no total, zero regressão.**

**`tsc --noEmit`:** limpo. **`next build`:** limpo, 65 rotas geradas.

### Bugs encontrados e corrigidos nesta rodada

1. **Vocabulário-gatilho do módulo (`vocabularioReconhecido`) rígido demais.** Frases como `"entrega aqui"` e `"aberto agora"` não batiam com a conjugação real (`"entregam aqui"`, `"abertos agora"`). Troquei por fragmentos curtos (`"entrega"`, `"aberto"`) — mesma lição já registrada na Oficina, agora confirmada como padrão recorrente: escrever vocabulário como fragmento curto, não frase fixa.
2. **Colisão entre duas intenções do mesmo módulo.** `"vocês entregam aqui no meu bairro?"` batia com o exemplo `"entregam"` da intenção **Delivery** (que vem antes na lista) antes de chegar em **Área de atendimento** — a resposta certa (sempre escalar) nunca era alcançada. Corrigido removendo o fragmento ambíguo de Delivery e deixando "área/bairro/região" exclusivos de Área de atendimento.
3. **Exemplo pedido na missão não coberto:** `"quanto tempo demora?"` não continha a palavra "preparo", então não ativava `tempo_preparo`. Acrescentei o fragmento `"demora"` ao vocabulário do módulo.

## 10. Checklist de homologação

- [x] Arquitetura — nenhuma nova, reaproveitou `DadosEmpresaUniversal.servicos` e o padrão `respostaSempreEscalar` já criado na Oficina
- [x] Intenções específicas implementadas (6 de consulta + 5 de sempre-escalar)
- [x] Vocabulário técnico do restaurante
- [x] Casos negativos cobertos (as 7 regras pedidas)
- [x] Cenários de transferência documentados
- [x] Testes positivos e negativos passando (22/22)
- [x] Isolamento de vocabulário validado nos 4 sentidos pedidos
- [x] `tsc --noEmit` e `next build` limpos, zero regressão em 109 testes
- [ ] Aprovação do Diretor — **pendente**
