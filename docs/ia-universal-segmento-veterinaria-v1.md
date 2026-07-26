# IA Universal — Homologação do Segmento: Veterinária

**Status:** implementado e testado, aguardando aprovação do Diretor. Segmento 13/13 — **último segmento da Fase 3.** Template único. **Nenhum outro segmento tocado.**

---

## 1. Objetivo

Reconhecer perguntas sobre emergência 24h, castração e vacinação a partir do que foi cadastrado — **nunca diagnosticar doença, nunca indicar medicamento, nunca orientar dosagem e nunca substituir a consulta veterinária**, mesmo que o tutor peça diretamente por preocupação com o animal.

## 2. Intenções específicas

| Intenção | Tipo | O que resolve |
|---|---|---|
| Emergência 24h / Castração / Vacinação | Consulta dado real | Empresa oferece este serviço? |
| Diagnóstico de doença | **Sempre escala** | Nunca avalia sintoma do animal |
| Indicação de medicamento | **Sempre escala** | Nunca indica remédio para o animal |
| Orientação de dosagem | **Sempre escala** | Nunca informa quantidade/dosagem |
| Substituir consulta veterinária | **Sempre escala** | Nunca resolve "sem precisar ir ao veterinário" |

## 3. Vocabulário

`emergencia`, `vacinacao`, `castracao`, `meu cachorro esta com`, `meu gato esta com`, `que remedio`, `quantos ml`, `levar ao veterinario`, `resolver sem ir`.

## 4. Exemplos

"atende emergência 24h?", "fazem castração?", "meu cachorro está com esses sintomas, o que ele pode ter?", "que remédio eu dou pro meu gato que está vomitando?", "quantos ml eu dou desse remédio?", "preciso mesmo levar ao veterinário ou dá pra resolver sem ir?".

## 5. Respostas base

Consulta real: honesto conforme dado cadastrado.
As quatro intenções sempre-escala têm respostas fixas de encaminhamento, nunca dependentes de dado — **especialmente crítico aqui**, já que o "paciente" (o animal) não pode relatar sintomas por si mesmo, tornando ainda mais arriscado qualquer palpite.

## 6. Regras negativas

Nunca avalia sintoma/doença do animal, nunca indica medicamento (nem "só um pouquinho" de algo caseiro), nunca informa dosagem em ml/mg, nunca sugere resolver o problema sem levar ao veterinário.

## 7. Transferência

As quatro intenções "sempre escala" já são o próprio encaminhamento.

## 8. Casos de segurança

Nenhuma resposta cita o OrganizaPro; dado de uma empresa não vaza para outra (testado); isolamento confirmado com Barbearia e Pet Shop — este último merece destaque: **mesmo compartilhando o tema "animal", os vocabulários não se confundem** (Pet Shop não reconhece "diagnóstico de doença" da Veterinária, e Veterinária não reconhece "tosa" do Pet Shop).

## 9. Testes

`.scratch/test-ia-universal-veterinaria.ts` — 14 verificações, todas passando após 3 correções.

### Bugs encontrados e corrigidos

1. **Bug real de arquitetura, não só de vocabulário:** `resolverModuloSegmento("Clínica Veterinária")` resolvia incorretamente para o módulo **Clínica** (médico), não para Veterinária! Causa: a seleção de módulo escolhia o primeiro nome alternativo que aparecesse no texto, na ordem do array — e "clinica" (nome do módulo Clínica) é substring de "clinica veterinaria". Esse mesmo problema poderia afetar "Clínica de Estética", "Clínica de Fisioterapia" e "Clínica de Psicologia" caso uma empresa real cadastrasse a especialidade assim. **Corrigido na função `resolverModuloSegmento`**: agora escolhe o nome alternativo **mais específico (mais longo)** entre todos os módulos, não o primeiro por ordem de array — resolve corretamente para todos os segmentos, independente de como a especialidade foi digitada. Validado que os demais segmentos continuam corretos após a correção (regressão completa).
2. **"Que remédio eu dou..."** não batia com o vocabulário-gatilho (`"que remedio dou"`, sem o "eu") — corrigido para o fragmento mais curto `"que remedio"`.
3. **"Preciso mesmo levar ao veterinário..."** não batia com as frases escritas — troquei por fragmentos curtos `"levar ao veterinario"` e `"resolver sem ir"`.

**Regressão final:** 266 testes no total (todos os 13 segmentos + IA Universal), zero regressão.

## 10. Checklist de homologação

- [x] Arquitetura — 1 correção real na seleção de módulo (benefício para todos os segmentos "Clínica de X", não só Veterinária)
- [x] Intenções específicas implementadas (3 de consulta + 4 de sempre-escalar)
- [x] Vocabulário técnico
- [x] Casos negativos cobertos (as 4 regras pedidas)
- [x] Cenários de transferência documentados
- [x] Testes positivos e negativos passando (14/14)
- [x] Isolamento de vocabulário validado (inclusive com Pet Shop, tema semelhante)
- [x] `tsc --noEmit` e `next build` limpos, zero regressão
- [ ] Aprovação do Diretor — **pendente**
