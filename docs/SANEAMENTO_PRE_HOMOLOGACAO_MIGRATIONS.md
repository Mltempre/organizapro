# OrganizaPro — Saneamento pré-homologação das migrations

**Natureza:** preparação estática; nenhum SQL foi executado
**Base:** `ae6198431f594e1858fdd323c469e1b793716f15`
**Branch isolada:** `audit/saneamento-migrations-fase2`
**Regra:** os arquivos em `sql/saneamento-pendente/` não pertencem ao runner de migrations. Eles só podem ser promovidos para uma migration depois de um pre-flight autorizado, revisão dos resultados e GO explícito.

## Decisão central

O estado real do Supabase é desconhecido. Portanto, esta entrega separa:

1. contrato canônico desejado;
2. consulta de pre-flight somente leitura;
3. caminho para objeto ausente;
4. caminho para objeto existente;
5. rollback e pós-validação.

`IF EXISTS`/`IF NOT EXISTS` não é usado para esconder divergência. Quando o estado não é compatível com o caminho preparado, o SQL aborta com uma mensagem explícita.

## Artefatos preparados

| Artefato | Finalidade | Executável agora? |
|---|---|---|
| `sql/saneamento-pendente/preflight-migrations-bloqueadores-v1.sql` | Catálogo, grants, policies, funções, views e queries de divergência | Somente futuramente, em ambiente autorizado; é read-only |
| `sql/saneamento-pendente/fix-origem-captacoes-canonica-nova-base-v1.sql` | Contrato canônico quando `origem_captacoes` estiver ausente | Não |
| `sql/saneamento-pendente/fix-pedidos-paciente-tenant-v1.sql` | FK composta tenant-safe de pedido para paciente | Não |
| `sql/saneamento-pendente/fix-oportunidades-update-governado-v1.sql` | Remove UPDATE direto e preserva transição por RPC server-side | Não |
| `sql/saneamento-pendente/fix-clinica-config-rls-v2.sql` | RLS transacional, allowlist de policies e vínculo ativo/produto | Não |
| `sql/saneamento-pendente/baseline-chatbot-leads-nova-base-v1.sql` | Schema integral do chatbot para banco novo | Não |
| `sql/saneamento-pendente/fix-chatbot-leads-existente-v1.sql` | Reconciliação defensiva de banco existente | Não |
| `sql/supabase-public-clinicas-policy.sql` | Arquivo perigoso aposentado; agora aborta sem alterar o banco | Não |

---

## 1. Atribuição / `origem_captacoes`

### Problema

As duas definições não convergem quando executadas em sequência:

- `sql/atribuicao-origem-fase1.sql` usa `criado_em`, FKs sem ações explícitas e nenhuma policy de leitura;
- `20260920000002_origem_captacoes_atribuicao_v1.sql` usa `created_at`, `ON DELETE CASCADE/SET NULL`, policy autenticada e grants explícitos;
- ambas usam `CREATE TABLE IF NOT EXISTS`, que não reconcilia uma tabela previamente criada;
- nenhuma garante no banco que `paciente_id` pertence à mesma `clinica_id`.

### Risco

Executar as duas pode produzir schema dependente da ordem, dois índices únicos equivalentes, policy/grants diferentes e vínculo cross-tenant de paciente.

### Contrato canônico desejado

- uma única coluna temporal: `criado_em`;
- `clinica_id` obrigatória, FK para `clinicas`, `ON DELETE CASCADE`;
- vínculo de paciente por FK composta `(paciente_id, clinica_id)`;
- `paciente_id` e `vinculado_em` nulos ou preenchidos juntos;
- código único por clínica;
- seis valores fechados de classificação;
- escrita somente server-side;
- leitura authenticated apenas com vínculo ativo e `clinicas.produto = 'organizapro'`;
- `anon` sem grant.

Os consumidores reais (`lib/origem-persistencia.ts`, Site público e webhook) usam somente os campos de captura/vínculo e não dependem de `created_at`/`criado_em`. A escolha por `criado_em` alinha este fato ao restante dos eventos comerciais do produto sem quebrar consumidor.

### Estado que precisa ser verificado

- existência da tabela;
- presença de `created_at`, `criado_em` ou ambas;
- divergência entre timestamps quando ambas existirem;
- FKs e ações de delete atuais;
- duplicidades `(clinica_id, codigo_rastreio)`;
- pacientes de outro tenant;
- policies, grants e índices reais;
- registro no histórico de migrations.

### Pre-fligh

Executar seções 1–7 do pre-flight e, se a tabela existir, a seção 8.1.

### Caminho A — tabela ausente

Usar o contrato de `fix-origem-captacoes-canonica-nova-base-v1.sql`. Não executar os dois SQLs anteriores numa instalação nova.

### Caminho B — tabela existente

- somente `criado_em`: preservar;
- somente `created_at`: preparar migration específica de rename/backfill após confirmar consumidores externos;
- ambas e valores iguais: preparar remoção da redundância em duas fases;
- ambas divergentes: STOP e decidir por linha; nenhum timestamp é escolhido silenciosamente;
- qualquer duplicidade ou paciente cross-tenant: corrigir caso a caso antes de criar constraints.

Não foi criado um reconciliador genérico para o caminho B porque ele precisaria escolher dados sem conhecer o banco.

### Rollback

No caminho A, remover a tabela somente antes de receber dados. Não remover o índice composto de pacientes enquanto houver FKs dependentes. No caminho B, o rollback deve ser gerado a partir do dump de schema/dados do pre-flight.

### Pós-validação

- captura server-side cria uma linha no tenant correto;
- replay de código é rejeitado pelo unique;
- vínculo aceita paciente do mesmo tenant e rejeita tenant B;
- anon não lê nem escreve;
- authenticated lê somente seu tenant ativo/OrganizaPro;
- deleção de paciente limpa somente `paciente_id`, preservando a captura.

---

## 2. Pedidos / E-commerce — paciente cross-tenan

### Problema

A migration de pedidos propõe `paciente_id REFERENCES pacientes(id)`, sem relacionar a clínica. A API autenticada recebe `paciente_id` do body e escreve com `service_role`. A filtragem do seletor no frontend não constitui garantia de banco.

### Risco

Um pedido da clínica A pode referenciar paciente da clínica B. Isso contamina Cliente 360, Follow-up, Copiloto, Financeiro e qualquer prova financeira por paciente.

### Contrato canônico desejado

`pedidos (paciente_id, clinica_id)` deve referenciar `pacientes (id, clinica_id)`. O vínculo é opcional; ao excluir o paciente, somente `paciente_id` fica nulo e o pedido histórico mantém seu tenant.

### Estado que precisa ser verificado

- existência das tabelas/colunas;
- tipo das duas colunas;
- FK atual de `paciente_id`;
- índice/unique composto em pacientes;
- pedidos já divergentes;
- ações de delete esperadas por operações existentes.

### Pre-fligh

Seções 2–5 e 8.2.

### Caminho A — migration de pedidos ainda ausente

Antes de promover a migration de pedidos, incorporar a FK composta desde a criação ou executar o fix na mesma janela transacional.

### Caminho B — pedidos já existentes

O fix preparado:

1. aborta se houver divergência;
2. cria o índice único composto em pacientes;
3. adiciona a FK como `NOT VALID` para proteger novas escritas;
4. valida todos os dados existentes;
5. confirma tudo na mesma transação.

### Rollback

Remover somente `pedidos_paciente_tenant_fk`. O índice de pacientes deve permanecer enquanto outro FK depender dele.

### Pós-validação

- insert/update com paciente do mesmo tenant passa;
- paciente do tenant B falha no banco mesmo usando service role;
- pedido sem paciente continua válido;
- exclusão do paciente mantém pedido e zera somente o vínculo;
- fluxos manual e público continuam funcionando.

---

## 3. Oportunidades — UPDATE direto versus RPC

### Problema

A migration cria uma policy authenticated de `UPDATE`, enquanto a máquina de estados e o replay vivem na RPC `transicionar_oportunidade_demanda_v1`. Se o role tiver grant de tabela, um cliente PostgREST pode alterar status/jornada diretamente.

### Risco

Contorno de transições, replay, concorrência e auditoria da oportunidade.

### Contrato canônico desejado

- authenticated pode conservar leitura legítima;
- criação permanece conforme o contrato existente até revisão separada;
- UPDATE direto por `PUBLIC`, `anon` e `authenticated` é revogado;
- a transição é executada somente pelo backend com `service_role` via RPC;
- RPC continua `SECURITY DEFINER`, com `search_path = public`, lock `FOR UPDATE`, tenant no predicado e execute somente para `service_role`.

### Estado que precisa ser verificado

- grants efetivos, inclusive por `PUBLIC`;
- todas as policies de UPDATE;
- owner, `prosecdef`, `proconfig`, assinatura e ACL da RPC;
- definição real da função;
- clientes externos que possam depender de UPDATE direto.

### Pre-fligh

Seções 4–6.

### Caminho A — contrato igual ao repositório

Aplicar `fix-oportunidades-update-governado-v1.sql`.

### Caminho B — grants/policies ou RPC divergentes

STOP. Comparar cada consumidor e preparar um fix específico. Não remover uma policy desconhecida automaticamente.

### Rollback

Somente pelo snapshot de grants/policies do pre-flight. Um rollback genérico recriaria o bypass.

### Pós-validação

- SELECT authenticated tenant A funciona e A não lê B;
- UPDATE direto recebe permission denied/zero linhas;
- RPC server-side aceita transição válida;
- transição inválida, replay e concorrência preservam o contrato;
- anon não executa a RPC.

---

## 4. Site público

### Problema

`sql/supabase-public-clinicas-policy.sql` autorizava SELECT em `clinicas` para qualquer linha com slug, sem produto, publicação ou allowlist de colunas.

### Risco

Exposição de toda coluna concedida da tabela e descoberta de tenants que não pertencem ao OrganizaPro.

### Contrato canônico desejado

O consumidor atual usa exclusivamente `site_publico_por_slug_v2(p_slug, 'organizapro')` para resolver o tenant. A saída necessária pela página pública é:

- identificação pública: `clinica_id`, nome, especialidade, cidade/estado;
- contato publicado: telefone, e-mail, endereço, WhatsApp e Google Maps;
- mídia/config pública: logo, hero, banner, avaliações, horário, redes e SEO.

Nenhum token Z-API, credencial, owner/user id ou configuração interna deve sair.

### Estado que precisa ser verificado

- definição, owner, `SECURITY DEFINER`, `search_path` e grants da RPC;
- filtro por slug, produto literal e eventual estado de publicação;
- colunas retornadas;
- policies/grants atuais de `clinicas`;
- definição/grants da view `clinica_config_publica`;
- policies públicas dos módulos filhos consumidos diretamente pelo navegador.

### Pre-fligh

Seções 3, 5 e 6.

### Caminho A — RPC segura e suficiente

Manter a RPC como porta pública e aposentar permanentemente a policy ampla. O arquivo perigoso agora aborta de forma explícita e não altera o banco.

### Caminho B — RPC ausente ou insegura

STOP. Versionar a definição real com retorno allowlisted e filtro de publicação/produto depois de conhecer o schema. Não é seguro inventar a RPC sem sua definição atual, que não está no repositório.

### Rollback

A aposentadoria do arquivo não altera banco. Se a policy ampla já existir, sua remoção futura deve ocorrer em migration própria após provar que todos os consumidores usam a RPC.

### Pós-validação

- slug OrganizaPro publicado retorna somente allowlist;
- slug de outro produto, nulo ou não publicado retorna zero;
- anon não consegue `SELECT * FROM clinicas`;
- metadados, página, interesse e pedido público continuam funcionando.

---

## 5. Site Premium / `clinica_config` RLS

### Problema

O fix histórico derruba todas as policies por enumeração dinâmica. Isso remove policies legítimas desconhecidas e pode deixar estado parcial se a criação da view falhar.

### Risco

Perda de acesso legítimo, exposição de segredos ou RLS parcialmente aplicada. As policies históricas também não exigem vínculo ativo nem produto OrganizaPro.

### Contrato canônico desejado

- alteração transacional;
- nenhuma policy desconhecida removida;
- authenticated só acessa tenant vinculado, ativo e do produto OrganizaPro;
- anon não acessa tabela base;
- DELETE negado;
- view/RPC pública tratada separadamente após introspecção;
- grants explícitos e mínimos.

### Estado que precisa ser verificado

- todas as policies e grants reais;
- RLS/force RLS e owner;
- colunas, inclusive credenciais;
- definição e grants da view/RPC pública;
- consumidores diretos authenticated de `clinica_config`;
- políticas que tenham nomes diferentes dos três canônicos.

### Pre-fligh

Seções 2–6, salvando resultado antes de qualquer futura alteração.

### Caminho A — nenhuma policy ou somente as três canônicas

O fix v2 substitui exatamente essas policies, exige `ativo = true` e produto literal, revoga anon/delete e concede apenas SELECT/INSERT/UPDATE a authenticated.

### Caminho B — qualquer policy desconhecida

O fix aborta. Classificar a policy como legítima ou insegura e preparar script nominal; nunca varrer todas.

### Rollback

Recriar exatamente as policies e grants exportados no pre-flight. Não existe rollback genérico confiável.

### Pós-validação

- anon não lê/escreve tabela base;
- tenant A lê/escreve A e não B;
- vínculo inativo e clínica de outro produto falham;
- DELETE falha;
- RPC/view pública não expõe tokens;
- editor do Site continua salvando os campos permitidos.

---

## 6. Chatbot — baseline

### Problema

O código atual usa o contrato completo da migration `20260624000003`: `score` inteiro, `etapa`, `porte_clinica`, `sistema_atual`, `dor_principal`, `ultima_interacao` e `origem`. A consolidada cobre as colunas das duas antigas, porém em uma tabela criada pela `000000` ela não torna `etapa` `NOT NULL DEFAULT 'inicial'`. A conversão atual também transforma qualquer texto desconhecido em 10 silenciosamente.

### Risco

Instalações diferentes terminam com nullability/defaults distintos e scores históricos perdem significado sem decisão humana. A tabela histórica também não possui FK para clínica nem revoke explícito.

### Contrato canônico desejado

- schema completo numa etapa;
- `score integer NOT NULL DEFAULT 10 CHECK (10,50,100)`;
- `etapa text NOT NULL DEFAULT 'inicial'`;
- FK de clínica;
- unique `(clinica_id, telefone)`;
- trigger dedicado de timestamp;
- RLS habilitado e sem acesso anon/authenticated;
- acesso somente server-side.

### Estado que precisa ser verificado

- tabela e migration history;
- colunas/tipos/default/nullability;
- valores distintos de score;
- etapas nulas;
- duplicidades de telefone por tenant;
- clínicas órfãs;
- triggers, constraints, policies e grants.

### Pre-fligh

Seções 2–5, 7 e 8.3.

### Caminho A — banco novo/tabela ausente

Não executar `000000` e `000001` como etapas intermediárias. Promover o baseline integral de nova base e registrar formalmente no histórico como a definição canônica. Os arquivos antigos permanecem no Git como história.

### Caminho B — banco existente desconhecido

O fix preparado:

- adiciona colunas faltantes;
- normaliza `etapa` e fecha default/nullability;
- converte score textual somente para `frio/morno/quente/10/50/100`;
- aborta para qualquer outro valor ou tipo;
- rejeita duplicidades e clínicas órfãs;
- adiciona constraints, trigger dedicado, RLS e revokes.

### Rollback

Backup obrigatório. Conversão de `score` não possui rollback genérico porque o valor textual original não é recuperável após a alteração de tipo.

### Pós-validação

- lead novo recebe score 10 e etapa inicial;
- upsert/replay mantém uma linha por tenant+telefone;
- score progride somente 10/50/100;
- tenant B não interfere em A;
- anon/authenticated não acessam a tabela diretamente;
- webhook server-side lê e grava todos os campos V3.

---

## Ordem recomendada depois de GO

1. congelar janela, confirmar projeto/host e gerar backups lógicos dos objetos envolvidos;
2. executar o pre-flight read-only e anexar o resultado à homologação;
3. reconciliar histórico/baseline do chatbot e aplicar o caminho A ou B;
4. escolher o caminho de `origem_captacoes`; nunca executar as duas definições antigas;
5. promover a migration de pedidos junto do fix tenant-safe;
6. fechar UPDATE direto de oportunidades;
7. aposentar/remover no banco eventual policy pública ampla de `clinicas`, somente após prova da RPC;
8. aplicar o fix nominal de `clinica_config`, depois de classificar todas as policies;
9. executar pós-validação Auth/RLS tenant A/B e superfícies públicas;
10. somente então homologar funcionalidades externas.

Cada bloco deve ser uma janela independente. Falha num bloco interrompe a sequência; não avançar para o próximo.

## Homologações externas posteriores

Este saneamento não substitui:

- Auth real anon/authenticated;
- PostgREST real e grants efetivos;
- tenant A/B e cross-tenant;
- Site público por slug/produto/publicação;
- pedido manual/público, replay e concorrência;
- oportunidade por RPC e bloqueio de UPDATE direto;
- webhook/chatbot em ambiente autorizado;
- Google Business Profile OAuth/callback/refresh/scopes;
- qualquer integração externa real.

## Riscos residuais

1. A definição de `site_publico_por_slug_v2` não está versionada neste repositório; precisa ser extraída do banco autorizado.
2. Não sabemos quais policies/grants existem hoje em `clinica_config`, `clinicas` e oportunidades.
3. Não sabemos se há dados cross-tenant em pedidos/origem ou scores históricos não mapeáveis.
4. Os módulos públicos (`clinica_galeria`, equipe, depoimentos, serviços, estrutura e FAQ) ainda possuem policies `USING (true)` nas migrations históricas; a necessidade de publicação por tenant deve ser tratada em uma revisão própria antes de exposição comercial ampla.
5. Os fixes preparados usam `ON DELETE SET NULL (paciente_id)`, que deve ser confirmado contra a versão PostgreSQL obtida no pre-flight antes da promoção para migration.

## Confirmação de segurança desta fase

- migration executada: **ZERO**;
- consulta ao Supabase: **ZERO**;
- Production alterada: **ZERO**;
- deploy/push/merge: **ZERO**;
- OAuth/WhatsApp/segredo: **ZERO**.

## Validação estática desta branch

- teste novo de saneamento: **9/9**;
- suíte completa do repositório com os dois diretórios de build exigidos pelos testes: **714 aprovados, 0 falhas, 5 skips previstos**;
- TypeScript `--noEmit`: aprovado;
- ESLint: aprovado;
- `git diff --check`: aprovado;
- build webpack: bloqueado por problema preexistente fora deste delta — `lib/google-business-profile.ts`, importado por `app/google-presenca/page.tsx`, leva `node:crypto` para a cadeia client-side (`UnhandledSchemeError`);
- build Turbopack no worktree: não conclusivo porque o worktree reutiliza dependências por junction e o Turbopack recusa symlink fora da raiz. A tentativa com cópia física foi interrompida por falta de espaço e o diretório temporário foi removido.

Nenhum arquivo funcional TypeScript/React foi alterado para contornar esses gates. O erro webpack deve ser tratado na frente dona de Google Business Profile.
