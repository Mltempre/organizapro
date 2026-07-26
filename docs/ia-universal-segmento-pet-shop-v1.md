# IA Universal — Homologação do Segmento: Pet Shop

**Status:** implementado e testado, aguardando aprovação do Diretor. Segmento 4/13, seguindo o template único (`docs/ia-universal-segmento-TEMPLATE.md`). **Nenhum outro segmento foi tocado nesta entrega** — Barbearia, Oficina Mecânica e Restaurante permanecem exatamente como estavam.

---

## 1. Objetivo

Ensinar a IA Universal a reconhecer perguntas típicas de pet shop sobre serviços (banho, tosa, vacinação geral, consulta veterinária, hotel, creche, ração, acessórios, busca em casa, entrega) a partir do que a empresa cadastrou — e, com a mesma disciplina da Oficina/Restaurante, **nunca confirmar** vacina específica, medicamento, diagnóstico veterinário, estoque ou vaga de hotel/creche, mesmo que pareça uma pergunta simples.

## 2. Intenções específicas

| Intenção | Tipo | O que resolve |
|---|---|---|
| Banho / Tosa / Vacinação (geral) / Consulta veterinária / Hotel / Creche / Ração / Acessórios / Aceita gato / Busca em casa / Entrega | Consulta dado real | Empresa oferece este serviço? |
| Produtos (geral) | Consulta dado real (lista) | O que a empresa tem cadastrado |
| Vacina específica | **Sempre escala** | Nunca confirma disponibilidade de uma vacina específica (ex.: antirrábica), mesmo com "Vacinação" cadastrada como serviço genérico |
| Medicamentos | **Sempre escala** | Nunca confirma estoque de remédio/antipulgas/vermífugo |
| Diagnóstico veterinário | **Sempre escala** | Nunca tenta avaliar sintoma do animal |
| Estoque (geral) | **Sempre escala** | Nenhum campo de estoque nesta fase |
| Disponibilidade de hotel/creche | **Sempre escala** | Nenhum campo de vaga/ocupação nesta fase |
| Formas de pagamento | **Sempre escala** | Proibido desde a Fase 1 |

**Reaproveitamento total, zero arquitetura nova:** todas as intenções de "consulta dado real" usam o mesmo `dados.servicos` já criado na Barbearia; todas as "sempre escala" usam o mesmo `respostaSempreEscalar` já criado na Oficina. "Produtos (geral)" reaproveita o mesmo padrão de listagem já usado no cardápio do Restaurante.

**Decisão importante sobre vacina:** a empresa pode ter "Vacinação" cadastrada como serviço genérico (então "vocês vacinam?" responde sim) — mas isso **não** dá base para confirmar uma vacina específica (antirrábica, V10, V8) estar em estoque agora. São duas intenções deliberadamente separadas para não deixar a IA parecer confirmar algo que ela não sabe de verdade.

## 3. Vocabulário

`banho`, `tosa`, `vacina`, `veterinari`, `hotel`, `hotelzinho`, `creche`, `racao`, `acessorio`, `produto`, `gato`, `felino`, `busca em casa`, `busca a domicilio`, `entrega`, `remedio`, `medicamento`, `vermifugo`, `antipulgas`, `estoque`, `vaga`, `disponibilidade`, `forma de pagamento`, `pix`, `doente`, `vomitando`, `machucou`.

## 4. Exemplos (incluindo os pedidos na missão)

| Intenção | Exemplos reais |
|---|---|
| Banho | "meu cachorro precisa de banho", "tem banho?" |
| Tosa | "faz tosa higiênica?", "fazem tosa?" |
| Vacinação (geral) | "vocês vacinam?", "fazem vacinação?" |
| Vacina específica | "vacina antirrábica", "tem vacina disponível?" |
| Ração | "tem ração premium?" |
| Aceita gato | "aceita gato?", "atende gato?" |
| Hotel | "tem hotelzinho?" |
| Busca em casa | "busca em casa?" |
| Diagnóstico | "meu cachorro está vomitando, o que pode ser?", "não está comendo" |
| Preço genérico | "quanto custa banho?" — capturado pela Camada 1 (`duvida_preco_generica`), resposta genérica segura, sem necessidade de intenção própria aqui |

## 5. Respostas base

| Intenção | Se cadastrado | Se não confirmado |
|---|---|---|
| Consulta dado real (todas) | "Sim, [fazemos/temos] X! Posso te ajudar a [agendar/confirmar]." | "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você." |
| Produtos (geral) | "Temos: [lista real]. Posso te ajudar com mais alguma coisa?" | "No momento não tenho os produtos confirmados aqui, mas posso confirmar com a equipe para você." |
| Vacina específica / Medicamentos / Estoque / Vaga / Pagamento (sempre) | *(mesma resposta de encaminhamento, independente de qualquer dado)* | idem |
| Diagnóstico veterinário (sempre) | "Prefiro não arriscar uma avaliação por aqui sem ver o animal — posso te conectar com a equipe para uma avaliação correta?" | idem |

## 6. Regras negativas

Todas as 6 pedidas na missão, confirmadas por teste: nunca inventa preço (delegado à Camada 1, segura por construção), vacina disponível, medicamento, diagnóstico veterinário, estoque ou disponibilidade (horários já são universais/Camada 1). Em especial: mesmo com "Vacina V10" cadastrada, a pergunta sobre "vacina antirrábica" (específica) nunca é confirmada como sim — testado explicitamente.

## 7. Transferência

Além dos 8 cenários da Biblioteca Mestre: as 6 intenções "sempre escala" já são o próprio encaminhamento — igual ao padrão já estabelecido na Oficina e no Restaurante.

## 8. Casos de segurança

- Nenhuma resposta cita o OrganizaPro (testado).
- Dado de uma empresa não vaza para outra (testado).
- **Isolamento nos 6 sentidos pedidos:** Pet Shop não reconhece Barbearia, Oficina nem Restaurante; e Barbearia, Oficina e Restaurante não reconhecem Pet Shop — todos os 6 testados individualmente.

## 9. Testes

`.scratch/test-ia-universal-petshop.ts` — 23 verificações. Todas passaram **já na primeira execução** — nenhum bug novo desta vez, porque apliquei desde o início as lições dos segmentos anteriores (fragmentos curtos de vocabulário em vez de frases fixas, cuidado com termos ambíguos, intenções conflitantes com fragmentos mutuamente exclusivos).

**Regressão:** suite da Fase 1 (55) + Barbearia (14) + Oficina (18) + Restaurante (22) re-executadas — **132 testes no total, zero regressão.**

**`tsc --noEmit`:** limpo. **`next build`:** limpo, 65 rotas geradas.

## 10. Checklist de homologação

- [x] Arquitetura — nenhuma nova; reaproveitou `dados.servicos`, `respostaDisponibilidadeServico` e `respostaSempreEscalar` já existentes
- [x] Intenções específicas implementadas (11 de consulta + 6 de sempre-escalar)
- [x] Vocabulário técnico do pet shop
- [x] Casos negativos cobertos (as 6 regras pedidas)
- [x] Cenários de transferência documentados
- [x] Testes positivos e negativos passando (23/23)
- [x] Isolamento de vocabulário validado nos 6 sentidos pedidos
- [x] `tsc --noEmit` e `next build` limpos, zero regressão em 132 testes
- [ ] Aprovação do Diretor — **pendente**
