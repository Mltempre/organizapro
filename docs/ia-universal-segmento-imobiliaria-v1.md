# IA Universal — Homologação do Segmento: Imobiliária

**Status:** implementado e testado, aguardando aprovação do Diretor. Segmento 6/13, template único. **Nenhum outro segmento tocado** — Barbearia, Oficina, Restaurante e Pet Shop permanecem exatamente como estavam.

---

## 1. Objetivo

Reconhecer perguntas sobre os serviços que a imobiliária oferece (aluguel, venda, avaliação, administração de condomínio) a partir do que foi cadastrado — e nunca confirmar disponibilidade de um imóvel específico, região atendida com precisão ou detalhes de uma unidade (quartos, metragem), já que isso exigiria um inventário de imóveis que não existe nesta fase.

## 2. Intenções específicas

| Intenção | Tipo | O que resolve |
|---|---|---|
| Aluguel / Venda / Avaliação de imóvel / Administração de condomínio | Consulta dado real | Empresa oferece este serviço? |
| Disponibilidade de imóvel | **Sempre escala** | Nunca confirma se há imóvel disponível numa região/perfil específico |
| Visita ao imóvel | **Sempre escala** | Nunca agenda visita sozinha, sempre confirma com a equipe |

## 3. Vocabulário

`imovel`, `aluguel`, `venda de imovel`, `avaliacao`, `condominio`, `bairro`, `regiao`, `metragem`, `quartos`, `visitar`.

## 4. Exemplos

"trabalham com aluguel?", "fazem avaliação de imóvel?", "tem apartamento disponível no bairro Centro?", "quero visitar o imóvel amanhã", "administram condomínio?".

## 5. Respostas base

Consulta real: "Sim, [trabalhamos com/fazemos] X! Posso te ajudar a confirmar com a equipe." / "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você."
Sempre escala: "Não tenho a disponibilidade de imóveis em tempo real aqui, mas posso confirmar com a equipe para você." (disponibilidade) / "Posso confirmar a visita com a equipe para você." (visita).

## 6. Regras negativas

Nunca confirma imóvel disponível em região/perfil específico sem dado real (não existe inventário de imóveis nesta fase); nunca agenda visita sozinha.

## 7. Transferência

As duas intenções "sempre escala" já são o próprio encaminhamento.

## 8. Casos de segurança

Nenhuma resposta cita o OrganizaPro; isolamento com os 4 segmentos anteriores confirmado nos dois sentidos (Imobiliária não reconhece Barbearia/Oficina/Restaurante/Pet Shop; Barbearia não reconhece Imobiliária).

## 9. Testes

`.scratch/test-ia-universal-imobiliaria.ts` — **12 verificações, todas passando já na primeira execução** (nenhum bug novo). Regressão completa (7 segmentos + Fase 1) sem falhas.

## 10. Checklist de homologação

- [x] Arquitetura — nenhuma nova
- [x] Intenções específicas implementadas (4 de consulta + 2 de sempre-escalar)
- [x] Vocabulário técnico
- [x] Casos negativos cobertos
- [x] Cenários de transferência documentados
- [x] Testes positivos e negativos passando (12/12)
- [x] Isolamento de vocabulário validado
- [x] `tsc --noEmit` e `next build` limpos, zero regressão
- [ ] Aprovação do Diretor — **pendente**
