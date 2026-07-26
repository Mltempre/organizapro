# IA Universal — Homologação do Segmento: Oficina Mecânica

**Status:** implementado e testado, aguardando aprovação do Diretor. Segmento 2/13, seguindo o template único (`docs/ia-universal-segmento-TEMPLATE.md`). **Nenhum outro segmento foi tocado nesta entrega** — Barbearia permanece como estava (homologada), os outros 11 continuam stub da Fase 1.

---

## 1. Objetivo

Ensinar a IA Universal a reconhecer perguntas típicas de uma oficina mecânica sobre serviços (revisão, troca de óleo, freios, alinhamento/balanceamento, atendimento por seguradora) a partir do que a empresa cadastrou — e, tão importante quanto, reconhecer quando o cliente está pedindo **diagnóstico técnico** ou **prazo de entrega**, e nesses dois casos **nunca tentar responder sozinha**, mesmo que pareça óbvio ou mesmo que o serviço esteja cadastrado.

## 2. Intenções específicas

| Intenção | Tipo | O que resolve |
|---|---|---|
| Revisão | Consulta dado real | Empresa oferece revisão? |
| Troca de óleo | Consulta dado real | Empresa oferece troca de óleo? |
| Freios | Consulta dado real | Empresa trabalha com freios? |
| Alinhamento/balanceamento | Consulta dado real | Empresa oferece alinhamento e/ou balanceamento? |
| Atende seguradora | Consulta dado real | Empresa atende por seguradora? |
| Diagnóstico sem avaliação | **Sempre escala** | Cliente descreve um sintoma e pergunta "o que pode ser" — nunca tenta adivinhar, mesmo que o veículo/sintoma pareça óbvio |
| Prazo de entrega | **Sempre escala** | Cliente pergunta quando o veículo fica pronto — nunca compromete uma data sem avaliação |

As duas últimas são o ponto central desta homologação: diferente da Barbearia (onde todo mundo é "consulta dado real"), a Oficina tem risco real de a IA parecer estar diagnosticando ou prometendo prazo — por isso usam um resolver que **sempre** devolve a mesma resposta de encaminhamento, **nunca** consultando `dados.servicos` (não faria sentido: o serviço estar cadastrado não dá à IA nenhuma base para diagnosticar ou estimar prazo).

## 3. Vocabulário

`alinhamento`, `balanceamento`, `revisao`, `troca de oleo`, `seguradora`, `freio`, `pastilha de freio`, `suspensao`, `bateria`, `barulho`, `diagnostico`, `prazo`, `fica pronto`, `embreagem`, `correia`, `nao liga`.

**Nota de precisão:** optei por termos curtos (`barulho`, `embreagem`, `correia`) em vez de frases completas (`barulho no carro`) depois que os testes pegaram o problema — cliente real escreve em ordens de palavra variadas ("meu carro tá fazendo um barulho" vs. "um barulho no carro"), e uma frase fixa perdia esses casos. Termo curto e específico o suficiente para não colidir com outro assunto (ex.: não usei `seguro` sozinho, porque em português também significa "confiante/certo" — ficaria com falso positivo fácil).

## 4. Exemplos

| Intenção | Exemplos reais |
|---|---|
| Revisão | "fazem revisão", "revisão completa", "revisão preventiva", "tem revisão" |
| Troca de óleo | "troca de óleo", "fazem troca de óleo", "preciso trocar o óleo", "trocam o óleo" |
| Freios | "mexem com freio", "trocam pastilha de freio", "fazem freio", "cuidam do freio" |
| Alinhamento/balanceamento | "fazem alinhamento", "fazem balanceamento", "alinham o carro" |
| Atende seguradora | "atende seguradora", "trabalha com seguro", "aceita seguradora", "atende pelo seguro" |
| Diagnóstico | "meu carro está fazendo um barulho estranho, o que pode ser?", "por que meu carro não liga?", "acho que é o motor", "será que é a correia", "acho que é a embreagem, pode ser?" |
| Prazo | "quando fica pronto?", "quanto tempo demora?", "qual o prazo?", "em quanto tempo fica pronto?" |

## 5. Respostas base

| Intenção | Se cadastrado | Se não confirmado |
|---|---|---|
| Revisão / Troca de óleo / Freios / Alinhamento-balanceamento | "Sim, [fazemos/trabalhamos com] X! Posso te ajudar a agendar." | "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você." |
| Atende seguradora | "Sim, atendemos por seguradora! Posso te ajudar a confirmar os detalhes com a equipe." | "No momento não tenho essa informação confirmada, mas posso verificar com a equipe para você." |
| Diagnóstico (sempre) | "Prefiro não arriscar um diagnóstico por aqui sem ver o veículo — posso te conectar com a equipe para uma avaliação correta?" | *(mesma resposta, independente de qualquer dado)* |
| Prazo (sempre) | "O prazo depende da avaliação do veículo — posso confirmar isso com a equipe assim que você trouxer o carro." | *(mesma resposta, independente de qualquer dado)* |

## 6. Regras negativas

- Serviço não cadastrado → nunca "não fazemos", sempre "não confirmado, posso verificar".
- **Diagnóstico:** mesmo que o cliente descreva o problema com detalhes e sugira uma causa ("acho que é a embreagem"), a IA nunca confirma nem descarta a suspeita — sempre a mesma resposta de encaminhamento.
- **Prazo:** nunca um número de dias/horas — a resposta nunca contém uma estimativa, mesmo vaga ("alguns dias", "rapidinho").
- `servicos` não carregado → resolver de consulta-dado-real devolve `null` (cai no sistema atual); os dois resolvers "sempre escala" não dependem de `servicos`, então sempre respondem, mesmo sem esse dado.

## 7. Transferência

Além dos 8 cenários já cobertos pela Biblioteca Mestre: **toda pergunta de diagnóstico ou prazo já é, por definição, um encaminhamento** (a resposta em si já direciona para a equipe) — não é um gatilho adicional de "2 tentativas falhas", é intencional desde a primeira mensagem.

## 8. Casos de segurança

- Nenhuma resposta do módulo cita o OrganizaPro (testado).
- Duas oficinas diferentes não compartilham resposta nem dado entre si (testado).
- Vocabulário de oficina não é reconhecido dentro do módulo de barbearia, e vocabulário de barbearia não é reconhecido dentro do módulo de oficina (testado nos dois sentidos).

## 9. Testes

`.scratch/test-ia-universal-oficina.ts` — 18 verificações, todas passando: serviços cadastrados (revisão, alinhamento/balanceamento) → afirmativo; serviços não cadastrados (alinhamento, seguradora) → honesto/negativo; diagnóstico nunca tenta adivinhar (2 variações de pergunta); prazo nunca inclui número; isolamento nos dois sentidos com barbearia; segurança comercial; isolamento entre tenants; intenção universal (endereço) continua funcionando. Suite geral da Fase 1 (55) + Barbearia (14) + `tsc --noEmit` + `next build` re-executados sem regressão.

**Dois bugs reais encontrados pelos testes nesta rodada** (mesmo padrão da Barbearia — testar de verdade em vez de confiar na leitura do código):
1. Vocabulário em frase completa (`"barulho no carro"`) não batia com a ordem real que um cliente escreve (`"carro fazendo um barulho"`) — troquei por termos curtos.
2. Duas variações de pergunta de diagnóstico/prazo com ordens de palavra diferentes das que eu tinha escrito nos exemplos não batiam — ampliei os fragmentos de correspondência.

## 10. Checklist de homologação

- [x] Arquitetura (reaproveitou `DadosEmpresaUniversal.servicos` da Barbearia — nenhuma mudança de arquitetura nova nesta fase, só de conteúdo)
- [x] Intenções específicas implementadas (5 de consulta + 2 de sempre-escalar)
- [x] Vocabulário técnico da oficina
- [x] Casos negativos cobertos (serviço não cadastrado, diagnóstico, prazo)
- [x] Cenários de transferência documentados
- [x] Testes positivos e negativos passando (18/18)
- [x] Isolamento de vocabulário validado (nos dois sentidos com Barbearia)
- [x] `tsc --noEmit` e `next build` limpos, sem regressão na suite geral
- [ ] Aprovação do Diretor — **pendente**
