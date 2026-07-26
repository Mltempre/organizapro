# IA Universal — Homologação do Segmento: Fisioterapia

**Status:** implementado e testado, aguardando aprovação do Diretor. Segmento 12/13, template único. **Nenhum outro segmento tocado.**

---

## 1. Objetivo

Reconhecer perguntas sobre RPG e tipos de tratamento a partir do que foi cadastrado — **nunca avaliar lesão, nunca prescrever exercício individualizado, nunca estimar tempo de recuperação**, sempre encaminhando para avaliação com o profissional.

## 2. Intenções específicas

| Intenção | Tipo | O que resolve |
|---|---|---|
| RPG | Consulta dado real | Empresa oferece RPG? |
| Tipos de fisioterapia (geral) | Consulta dado real (lista) | Quais tratamentos são oferecidos |
| Avaliação de lesão | **Sempre escala** | Nunca avalia gravidade/causa de uma lesão |
| Prescrição de exercício | **Sempre escala** | Nunca monta ou indica exercício específico |
| Tempo de recuperação | **Sempre escala** | Nunca estima prazo de recuperação |
| Necessidade de encaminhamento | **Sempre escala** | Nunca confirma se precisa de pedido médico sem checar com a equipe |

## 3. Vocabulário

`rpg`, `encaminhamento medico`, `sessao de fisioterapia`, `machucou`, `machuquei`, `essa dor`, `qual exercicio`, `me passa um exercicio`, `tempo de recuperacao`, `quanto tempo leva`, `quantas sessoes`.

## 4. Exemplos

"fazem RPG?", "machuquei o ombro treinando, o que pode ser?", "qual exercício eu faço pra dor nas costas?", "quanto tempo leva pra recuperar dessa lesão no joelho?".

## 5. Respostas base

Consulta real: honesto conforme dado cadastrado.
As quatro intenções sempre-escala têm respostas fixas de encaminhamento, nunca dependentes de dado.

## 6. Regras negativas

Nunca avalia gravidade/causa de uma dor ou lesão, nunca indica um exercício específico, nunca estima prazo numérico de recuperação, nunca confirma necessidade de encaminhamento médico sem verificar com a equipe.

**Nota sobre vocabulário compartilhado com Academia:** "machuquei"/"lesão" aparecem legitimamente nos dois módulos (ambos lidam com lesão física) — isso não é uma falha de isolamento, já que cada tenant só carrega o **próprio** módulo. O teste de isolamento deste segmento usa o termo exclusivo "RPG" para confirmar que o vocabulário técnico específico não vaza, em vez de testar com "machuquei" (que seria um falso positivo de teste, não um bug real).

## 7. Transferência

As quatro intenções "sempre escala" já são o próprio encaminhamento.

## 8. Casos de segurança

Nenhuma resposta cita o OrganizaPro; isolamento confirmado com Imobiliária, Contabilidade e Academia (nos dois sentidos, usando termo exclusivo).

## 9. Testes

`.scratch/test-ia-universal-fisioterapia.ts` — 12 verificações, todas passando após 2 correções.

### Bugs encontrados e corrigidos

1. **"Machuquei o ombro..."** não batia com o vocabulário-gatilho, que só tinha `"machucou"` (3ª pessoa) — acrescentei `"machuquei"` (1ª pessoa), mesma lição de conjugação já recorrente.
2. **"Quanto tempo leva pra recuperar..."** não batia com o vocabulário-gatilho `"tempo de recuperacao"` — acrescentei o fragmento `"quanto tempo leva"`.

## 10. Checklist de homologação

- [x] Arquitetura — nenhuma nova
- [x] Intenções específicas implementadas (2 de consulta + 4 de sempre-escalar)
- [x] Vocabulário técnico
- [x] Casos negativos cobertos (as 3 regras pedidas + encaminhamento)
- [x] Cenários de transferência documentados
- [x] Testes positivos e negativos passando (12/12)
- [x] Isolamento de vocabulário validado
- [x] `tsc --noEmit` e `next build` limpos, zero regressão
- [ ] Aprovação do Diretor — **pendente**
