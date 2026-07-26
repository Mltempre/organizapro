# IA Universal — Homologação do Segmento: Clínica

**Status:** implementado e testado, aguardando aprovação do Diretor. Segmento 10/13, template único. **Nenhum outro segmento tocado.**

---

## 1. Objetivo

Reconhecer perguntas sobre convênio e especialidades atendidas a partir do que foi cadastrado — e **nunca diagnosticar, nunca interpretar exame, nunca indicar medicamento e nunca orientar tratamento sem avaliação**, mesmo que a pergunta pareça simples ou o cliente insista.

## 2. Intenções específicas

| Intenção | Tipo | O que resolve |
|---|---|---|
| Atende convênio | Consulta dado real | Empresa atende este convênio/plano? |
| Especialidades (geral) | Consulta dado real (lista) | Em quais especialidades a clínica atua |
| Diagnóstico médico | **Sempre escala** | Nunca avalia sintoma nem dá diagnóstico |
| Interpretação de exame | **Sempre escala** | Nunca interpreta resultado de exame |
| Indicação de medicamento | **Sempre escala** | Nunca indica remédio |
| Orientação de tratamento sem avaliação | **Sempre escala** | Nunca prescreve conduta sem consulta |

## 3. Vocabulário

`convenio`, `procedimento`, `exame`, `especialidade medica`, `diagnostico`, `o que eu tenho`, `exame deu alterado`, `que remedio`, `posso tomar`, `como eu trato`, `o que eu faco pra melhorar`.

## 4. Exemplos

"atende convênio?", "quais especialidades vocês atendem?", "o que eu tenho? esses sintomas são de que doença?", "meu exame deu alterado, o que significa?", "que remédio eu tomo pra dor de cabeça?", "como eu trato isso sem precisar ir na consulta?".

## 5. Respostas base

Consulta real: "Sim, [atendemos/trabalhamos com] X! ..." / honesto quando não confirmado.
As quatro intenções sempre-escala têm cada uma sua resposta fixa de encaminhamento, nunca dependente de dado (ver seção 6 abaixo).

## 6. Regras negativas

Nunca avalia sintoma/dá diagnóstico, nunca interpreta resultado de exame, nunca indica medicamento (nem genérico), nunca orienta conduta/tratamento sem consulta — em nenhuma circunstância, mesmo com dados cadastrados.

## 7. Transferência

As quatro intenções "sempre escala" já são o próprio encaminhamento.

## 8. Casos de segurança

Nenhuma resposta cita o OrganizaPro; isolamento confirmado com Barbearia, Estética e Oficina (nos dois sentidos).

## 9. Testes

`.scratch/test-ia-universal-clinica.ts` — **13 verificações, todas passando já na primeira execução.**

## 10. Checklist de homologação

- [x] Arquitetura — nenhuma nova
- [x] Intenções específicas implementadas (2 de consulta + 4 de sempre-escalar)
- [x] Vocabulário técnico
- [x] Casos negativos cobertos (as 4 regras pedidas)
- [x] Cenários de transferência documentados
- [x] Testes positivos e negativos passando (13/13)
- [x] Isolamento de vocabulário validado
- [x] `tsc --noEmit` e `next build` limpos, zero regressão
- [ ] Aprovação do Diretor — **pendente**
