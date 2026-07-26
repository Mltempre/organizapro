# IA Universal — Homologação do Segmento: Psicologia

**Status:** implementado e testado, aguardando aprovação do Diretor. Segmento 11/13, template único. **Nenhum outro segmento tocado.**

---

## 1. Objetivo

Reconhecer perguntas sobre atendimento online e abordagens terapêuticas a partir do que foi cadastrado — **nunca diagnosticar transtorno, nunca interpretar sintoma como diagnóstico, nunca substituir o atendimento psicológico**, e encaminhar para profissional sempre que necessário. Com um cuidado adicional: mensagens que sinalizam risco/crise têm **prioridade absoluta** sobre qualquer outra intenção deste módulo.

## 2. Intenções específicas

| Intenção | Tipo | O que resolve |
|---|---|---|
| Situação de crise | **Sempre escala (prioridade máxima)** | Acolhe e encaminha imediatamente, sem tentar resolver ou aprofundar |
| Atendimento online | Consulta dado real | Empresa atende online? |
| Abordagens (geral) | Consulta dado real (lista) | Quais abordagens terapêuticas são oferecidas |
| Diagnóstico de transtorno | **Sempre escala** | Nunca confirma/nega um transtorno |
| Interpretação de sintoma | **Sempre escala** | Nunca interpreta o que o cliente sente como diagnóstico |
| Substituir atendimento | **Sempre escala** | Nunca aconselha ou orienta psicologicamente pelo chat |

**Decisão de segurança importante:** a intenção "situação de crise" é verificada **antes** de qualquer outra no array de intenções do módulo — se a mensagem contém linguagem de risco ("não aguento mais", "penso em me machucar"), essa resposta prevalece mesmo que a mesma mensagem também mencione um sintoma ou palavra de diagnóstico. Testado explicitamente.

## 3. Vocabulário

`atendimento online`, `atende online`, `abordagem terapeutica`, `terapia`, `tenho ansiedade`, `tenho depressao`, `isso e transtorno`, `esses sintomas`, `me ajuda a resolver`, `nao aguento mais`, `penso em me machucar`, `nao vejo sentido`.

## 4. Exemplos

"atende online?", "acho que tenho ansiedade, é isso mesmo?", "esses sintomas que estou sentindo são normais?", "me ajuda a resolver isso agora, me dá uma orientação psicológica", "não aguento mais, não vejo sentido em nada".

## 5. Respostas base

Consulta real: honesto conforme dado cadastrado.
Crise (sempre, tom de acolhimento): "O que você está sentindo é importante, e você não precisa passar por isso sozinho(a). Vou te conectar agora com a equipe para que alguém possa te ajudar."
Diagnóstico/sintoma/substituição (sempre): respostas de encaminhamento, nunca uma tentativa de aconselhar.

## 6. Regras negativas

Nunca confirma ou sugere um transtorno específico, nunca interpreta um relato de sintoma como diagnóstico, nunca substitui a orientação de um profissional — em nenhuma circunstância.

## 7. Transferência

Além das três intenções "sempre escala" (que já são o encaminhamento), a intenção de crise tem tratamento diferenciado: encaminhamento **imediato e prioritário**, sem exigir uma segunda tentativa de esclarecimento como a regra geral da Biblioteca Mestre prevê para outras ambiguidades.

## 8. Casos de segurança

Nenhuma resposta cita o OrganizaPro; isolamento confirmado com Pet Shop, Oficina e Contabilidade (nos dois sentidos).

## 9. Testes

`.scratch/test-ia-universal-psicologia.ts` — 14 verificações, todas passando após 1 correção.

### Bug encontrado e corrigido

**"Atende online?"** não batia com o vocabulário-gatilho `"atendimento online"` (falta a palavra "mento") — acrescentei o fragmento `"atende online"`, mesma lição recorrente dos segmentos anteriores.

**Regressão:** 240 testes anteriores (na numeração desta fase) + 14 novos, zero regressão.

## 10. Checklist de homologação

- [x] Arquitetura — nenhuma nova
- [x] Intenções específicas implementadas (1 de crise + 2 de consulta + 3 de sempre-escalar)
- [x] Vocabulário técnico
- [x] Casos negativos cobertos
- [x] Cenários de transferência documentados (incl. prioridade de crise)
- [x] Testes positivos e negativos passando (14/14)
- [x] Isolamento de vocabulário validado
- [x] `tsc --noEmit` e `next build` limpos, zero regressão
- [ ] Aprovação do Diretor — **pendente**
