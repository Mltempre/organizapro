# Conta Comercial Oficial de Demonstração — Barbearia Black Crown

Tenant real e persistente no mesmo banco de produção, isolado por `clinica_id`
dedicado (nunca reaproveita nenhuma conta existente — ver decisão do
Diretor, 2026-07-30). Criado para apresentações comerciais ao vivo do
`/dashboard` real, não do `/dashboard-demo` sintético.

## Acesso

- **URL:** https://www.organizaprooficial.com.br/login
- **E-mail:** `barbearia.demo@organizaprooficial.com.br`
- **Senha:** compartilhada apenas verbalmente/por canal seguro — nunca
  gravada em nenhum arquivo deste repositório.
- **Site público:** https://www.organizaprooficial.com.br/empresa/barbearia-black-crown

## Identificadores

Ver `docs/conta-comercial-demo.json` (mesmo diretório) para `user_id`,
`clinica_id` e data de criação — usados pelos scripts abaixo.

## Scripts de manutenção

| Script | Uso |
|---|---|
| `scripts/criar-conta-comercial-demo.mjs` | Criação única. Idempotente — aborta se e-mail/slug já existirem. |
| `scripts/resetar-conta-comercial-demo.mjs` | Rodar **antes de cada apresentação**. Apaga só pacientes/agendamentos/avaliações e recarrega o cenário canônico com datas relativas ao dia em que roda. Não mexe em login, configuração ou Site Premium. |
| `scripts/remover-conta-comercial-demo.mjs` | Decomissionamento total (uso único, se a conta for encerrada). Apaga tudo, incluindo o login. |
| `scripts/lib/cenario-barbearia-black-crown.mjs` | Módulo de dados puro com a história canônica — editar aqui para ajustar o cenário. |

## Cenário canônico (o que o reset sempre recria)

- 18 clientes cadastrados, 29 agendamentos no total
- 11 atendimentos concluídos no mês corrente
- 3 horários vagos hoje (agenda 09h–17h, 5 de 8 horários ocupados)
- 1 confirmação pendente hoje (Fernando Silveira)
- 1 cancelamento sem reagendar (Roberto Cardoso, há 3 dias)
- 2 clientes sem retorno há 45+ dias (Eduardo Bastos, Marcos Antunes)
- 4 avaliações aguardando resposta (+ 3 já respondidas, para uma taxa de resposta saudável)
- 12 compromissos nos próximos 7 dias (≥5 — evita o texto "receita prevista" que `lib/recomendacoes.ts` dispara com 1–4)
- Sem WhatsApp/Z-API real conectado — os links "Abrir WhatsApp"/"Entrar em contato" funcionam via `wa.me` direto para o número fictício do cliente, sem depender de integração da própria clínica
- Site Premium: 4 serviços, 2 barbeiros (especialidades diferentes), 3 depoimentos curtos — sem galeria, estrutura ou antes/depois

**Nota de coerência:** `clientesParaReativar` fica em **3**, não 2 — Roberto
Cardoso (o cancelamento) também não tem retorno agendado, o que é
verdadeiro e não foi mascarado com um dado fictício desencontrado do
restante do cenário.

## Não fazer

- Não reaproveitar nem apagar a conta `demo@organizaprooficial.com.br`
  ("Atelier Nova Onda") — é um recurso diferente, intocado por decisão
  explícita do Diretor.
- Não conectar uma instância Z-API real a este tenant.
- Não editar dados desta conta manualmente sem depois rodar o reset antes
  da próxima apresentação (senão o cenário fica com o estado da última
  demonstração, não o canônico).
