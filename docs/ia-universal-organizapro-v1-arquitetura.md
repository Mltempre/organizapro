# IA Universal do OrganizaPro — Arquitetura V1

**Status:** proposta para revisão. Nenhuma linha de código de produção foi alterada para produzir este documento. Aguardando aprovação do Diretor antes de qualquer implementação.

**Como este documento se conecta ao resto do projeto:** existe hoje uma "Base Oficial de Conhecimento" (V1 congelada com 56 treinamentos + V2 em elaboração, ver `docs/chatbot-base-conhecimento-v2-*.md`) — mas ela é o conteúdo do chatbot de **vendas do próprio OrganizaPro** (o SDR que qualifica quem quer *comprar* o sistema, isolado hoje por um único ID de tenant fixo em `app/api/chatbot/message/route.ts`). Este documento trata de um assunto diferente e maior: o chatbot que **cada cliente do OrganizaPro** (a barbearia, a oficina, o escritório de advocacia) usa para atender **os próprios clientes finais**. Os dois sistemas hoje dividem o mesmo endpoint por acidente histórico — parte da proposta abaixo é separar essa responsabilidade com clareza.

---

## 0. Diagnóstico do que já existe (ponto de partida real, não teórico)

Antes de desenhar algo novo, o que já está em produção hoje:

| Peça | Onde vive | O que faz hoje | Problema para a IA Universal |
|---|---|---|---|
| Classificador de tópico | `classificarTopico()` em `app/api/chatbot/message/route.ts` | Regex fixo: `horario`, `endereco`, `convenios`, `procedimentos`, `consulta`, `faq`, `agendar`, `saudacao`, `humano`, `default` | `convenios` e `procedimentos` são vocabulário **de clínica**, hardcoded na camada que deveria ser universal. Uma barbearia ou oficina nunca deveria ver esses tópicos. |
| Montagem de resposta | `montarResposta()` | `switch` fixo por tópico, lê campos de `chatbot_config` | Mistura Camada 1 (lógica) com Camada 3 (dados) no mesmo `switch`; sem esclarecimento quando falta dado, alguns casos caem num texto genérico "entre em contato" |
| Base de conhecimento por tenant | `chatbot_treinamento` (`pergunta`, `resposta`, `palavras_chave`, `ativo`) | Cada empresa pode cadastrar perguntas/respostas próprias, casadas por palavra-chave | Mecanismo já é 100% universal e reutilizável — vira a base da Camada 3 |
| Configuração do chatbot | `chatbot_config` (`horario_funcionamento`, `endereco`, `convenios`, `procedimentos`, `faq`, `link_humano`, `ativo`) | Campos fixos, alguns clínicos | Só uma fração do que a empresa já cadastra em outros lugares do sistema |
| Dados reais da empresa (mais ricos) | `clinicas` (inclui `especialidade` — **já é o campo de segmento, hoje texto livre**), `clinica_config`, `clinica_servicos`, `clinica_equipe`, `clinica_faq` (parcial), `clinica_depoimentos` | Usado hoje pelo Site Premium público (`app/empresa/[slug]`) | A IA de atendimento **não lê nada disso** — duplica parcialmente em `chatbot_config` em vez de reaproveitar |
| Pontuação de lead | `chatbot_leads` (`etapa`, `score`, ...) | Score genérico (`calcularScore`) roda para **qualquer tenant**, mas as frases-gatilho ("quero contratar", "mensalidade") são do vocabulário de vendas do próprio OrganizaPro | Mecanismo de score já é universal na forma, mas calibrado para o segmento errado — é o embrião real da Camada 4, não uma peça nova |
| Isolamento do funil de vendas do OrganizaPro | `TENANT_SDR_ORGANIZAPRO` (ID fixo) em `app/api/chatbot/message/route.ts` | Só esse tenant entra no funil SDR (qualificação de lead, `perguntaSDR`, `respostaPorDor`) | Prova que o padrão "isolar por tenant dentro do mesmo endpoint" já existe — mas feito com `if` fixo, não com arquitetura de módulo |

**Conclusão do diagnóstico:** a base (treinamento por palavra-chave, config por tenant, isolamento por `clinica_id`) já é sólida e universal. O que precisa mudar é: (1) tirar vocabulário de clínica da camada universal, (2) a IA passar a ler os dados reais já cadastrados (serviços, equipe, FAQ, especialidade) em vez de campos redundantes, (3) transformar o `especialidade` de texto livre em chave de módulo de segmento, (4) separar de vez o funil comercial do OrganizaPro (que é, ele mesmo, só mais um "segmento": venda de software) da IA que atende os clientes finais de cada tenant.

---

## 1. Princípios (herdados do CLAUDE.md e não negociáveis aqui)

1. **Uma IA Universal, não uma IA por segmento.** Segmento é conhecimento adicional, nunca um fork de código.
2. **Nunca inventar.** Se o dado não está cadastrado, a IA admite que não sabe e oferece um caminho (perguntar, encaminhar para humano) — nunca preenche a lacuna com suposição.
3. **Isolamento por tenant é absoluto.** Toda leitura de dado é filtrada por `clinica_id`; nenhuma camada pode, por engano, misturar dados entre empresas.
4. **Dado da empresa vem de onde ele já existe.** Se a empresa já cadastrou serviços, equipe, horário, redes sociais em outro lugar do sistema, a IA lê de lá — não duplica cadastro.
5. **Regra de negócio do OrganizaPro (ver `CLAUDE.md`) também vale aqui:** cada peça desta arquitetura só entra se resolver um problema real — reduzir tempo de resposta, evitar pergunta sem resposta, evitar atendimento genérico demais para um segmento específico.

---

## 2. Arquitetura geral — as 4 camadas

```
┌──────────────────────────────────────────────────────────────────────┐
│  MENSAGEM DO CLIENTE FINAL (WhatsApp, via Z-API)                      │
└───────────────────────────────┬────────────────────────────────────────┘
                                 ▼
                    ┌────────────────────────┐
                    │  CAMADA 3 — Carrega     │   dados da empresa autenticada
                    │  contexto da empresa    │   (clinica_id) — nunca de outra
                    └───────────┬────────────┘
                                 ▼
                    ┌────────────────────────┐
                    │  CAMADA 1 — Núcleo      │   saudação, intenção, segurança,
                    │  Universal              │   "não invente", esclarecimento,
                    │  (sempre executa)       │   encaminhamento humano
                    └───────────┬────────────┘
                                 │  intenção resolvida universalmente?
                        não ─────┤───── sim → responde e encerra
                                 ▼
                    ┌────────────────────────┐
                    │  CAMADA 2 — Módulo do   │   conhecimento específico do
                    │  Segmento               │   segmento (barbearia, oficina...)
                    │  (só o módulo da        │   complementa, nunca substitui
                    │  empresa é carregado)   │   a Camada 1
                    └───────────┬────────────┘
                                 ▼
                    ┌────────────────────────┐
                    │  CAMADA 4 — IA          │   (ROADMAP — não implementar
                    │  Comercial              │   agora) follow-up, recuperação,
                    │  (desligada por padrão) │   upsell, cross-sell
                    └────────────────────────┘
```

A ordem importa: Camada 3 carrega **dados**, não decide nada. Camada 1 sempre roda primeiro e tenta resolver sozinha (ela já cobre a maioria das mensagens de qualquer negócio: saudação, despedida, "qual o horário", "quero falar com alguém"). Só quando a Camada 1 não sabe responder — porque a pergunta é específica do segmento ("vocês fazem alinhamento?", "atende convênio X?", "corta cabelo infantil?") — a Camada 2 é consultada. A Camada 4 não roda nesta fase; existe só como contrato de extensão (seção 8).

---

## 3. Camada 1 — Núcleo Universal

### 3.1 Responsabilidades (mapeadas 1:1 com o pedido da missão)

| Responsabilidade | Mecanismo |
|---|---|
| Saudação | Template universal, sem citar segmento — variação só pelo nome da empresa (Camada 3) |
| Despedida | Template universal |
| Educação/tom profissional | Regras de estilo aplicadas a **toda** resposta antes do envio (ver 3.3) |
| Identificação de intenção | Classificador de intenção **universal** (ver 3.2) — troca o `classificarTopico` atual, sem vocabulário de clínica |
| Confirmação de informações | Antes de agir sobre algo ambíguo ("agendar", "cancelar"), a IA reformula e confirma |
| Regras de segurança | Nunca citar dado de outro tenant; nunca simular ser humano quando perguntado diretamente; nunca prometer prazo/preço que não está cadastrado |
| Nunca inventar | Toda resposta que dependeria de um dado ausente cai em "não tenho essa informação, mas posso confirmar com a equipe" |
| Solicitar esclarecimento | Quando a intenção é ambígua entre 2+ opções, a IA pergunta antes de responder errado |
| Encaminhamento humano | Sempre disponível como intenção de primeira classe (`humano`), e como saída de segurança quando nada mais resolve |

### 3.2 Classificador de intenção universal

Substitui `classificarTopico()`. Em vez de tópicos específicos de clínica, as intenções da Camada 1 são as que **qualquer** negócio com agenda e clientes recorrentes tem:

```ts
type IntencaoUniversal =
  | "saudacao"
  | "despedida"
  | "horario_funcionamento"
  | "endereco_localizacao"
  | "agendar"
  | "reagendar_cancelar"
  | "confirmar_presenca"
  | "duvida_preco_generica"     // "quanto custa" sem especificar o quê
  | "falar_com_humano"
  | "elogio_reclamacao"
  | "fora_do_escopo"            // ex.: pergunta que não é sobre o negócio
  | "intencao_especifica_segmento"; // sinaliza "não resolvo sozinha, delega à Camada 2"
```

O classificador é uma função pura (mesmo padrão de `lib/recomendacoes.ts`/`lib/oportunidades-clientes.ts`: determinística, sem IA generativa nesta fase, testável isoladamente). Ela **nunca** reconhece termos como "convênio", "procedimento", "corte", "revisão" — esses só existem dentro dos módulos de segmento (Camada 2).

### 3.3 Regras de estilo (aplicadas sempre, universais)

- Tom profissional, cordial, frases curtas.
- Nunca usar jargão de um segmento ao falar com outro (a validação de que o texto de resposta não contém vocabulário de outro módulo é uma regra automática, não só uma boa intenção).
- Toda resposta que cita um dado (horário, endereço, serviço, preço) só é enviada se esse dado existir de fato na Camada 3 — nunca como texto fixo no código.
- Limite de tentativas: se a IA não entende a mesma intenção 2 vezes seguidas, encaminha para humano automaticamente (evita loop frustrante).

---

## 4. Camada 2 — Módulos de Segmento

### 4.1 Contrato de um módulo

Cada segmento é um objeto que **só adiciona**, nunca substitui, o núcleo:

```ts
type ModuloSegmento = {
  chave: string;                 // "barbearia", "oficina", "advocacia", ...
  nomesAlternativos: string[];   // para mapear especialidade" (texto livre) → chave
  intencoesAdicionais: {
    id: string;
    exemplosDeFrase: string[];   // frases reais de clientes, usadas no matching
    respostaBase: (empresa: DadosEmpresa) => string | null; // null = "não sei", não inventa
    requerDado?: (keyof DadosEmpresa)[]; // dados que precisam existir para responder
  }[];
  vocabularioReconhecido: string[]; // termos que disparam "intencao_especifica_segmento" com este módulo
};
```

### 4.2 Seleção do módulo — sem migração de banco

`clinicas.especialidade` **já existe** e já é preenchido (texto livre: "Barbearia", "Oficina Mecânica", "Advocacia"...). A seleção do módulo é uma função de mapeamento, não uma nova coluna:

```ts
function resolverModuloSegmento(especialidadeTexto: string): ModuloSegmento {
  // normaliza e compara contra `nomesAlternativos` de cada módulo;
  // sem correspondência → devolve o módulo "generico" (Camada 2 vazia,
  // só a Camada 1 responde) — nunca quebra, nunca inventa segmento.
}
```

Isso significa: **zero alteração de schema** para lançar a V1 desta arquitetura. Quando fizer sentido, um campo `clinicas.segmento_chave` (enum controlado) pode ser adicionado depois para não depender de correspondência de texto — mas isso é uma melhoria futura, não um bloqueador.

### 4.3 Os 13 segmentos pedidos — como módulos, não como código separado

| Segmento | Exemplos de intenção adicional | Dado que ele consulta em Camada 3 |
|---|---|---|
| Advogados | "qual área vocês atuam", "fazem consulta inicial gratuita" | serviços, FAQ |
| Barbearias | "corta cabelo infantil", "faz barba" | serviços |
| Oficinas | "fazem alinhamento", "atende seguradora X" | serviços |
| Restaurantes | "tem opção vegetariana", "fazem entrega" | serviços, horário |
| Clínicas | "atende convênio X", "quais procedimentos" | serviços, equipe (especialidade do profissional) |
| Pet Shops | "fazem banho e tosa", "atende emergência" | serviços |
| Academias | "tem aula experimental", "horário de musculação" | horário, serviços |
| Imobiliárias | "tem imóvel na região X", "faz avaliação" | serviços |
| Contadores | "abrem MEI", "fazem declaração de IR" | serviços |
| Estéticas | "fazem limpeza de pele", "qual produto usam" | serviços |
| Fisioterapia | "atende RPG", "precisa de encaminhamento médico" | serviços, equipe |
| Psicologia | "atende online", "qual abordagem" | equipe, serviços |
| Veterinária | "atende emergência 24h", "fazem vacinação" | serviços, horário |

Cada linha acima é **dado de configuração**, não uma implementação separada — todos os 13 usam exatamente o mesmo motor da Camada 1/2, só trocando a tabela de intenções adicionais e o vocabulário reconhecido.

---

## 5. Camada 3 — Dados da Empresa

### 5.1 Fonte de verdade (reaproveitar o que já existe, não duplicar)

```ts
type DadosEmpresa = {
  nome:          string;                 // clinicas.nome
  segmento:      string;                 // clinicas.especialidade (texto livre)
  telefone?:     string;                 // clinica_config.telefone
  endereco?:     string;                 // clinica_config.endereco
  horario?:      string;                 // clinica_config.horario_funcionamento
  redesSociais?: { instagram?: string; facebook?: string; tiktok?: string }; // clinica_config
  servicos:      { nome: string; descricao?: string; preco?: number }[];     // clinica_servicos
  equipe:        { nome: string; especialidade?: string; descricao?: string }[]; // clinica_equipe
  faq:           { pergunta: string; resposta: string }[];                   // clinica_faq (quando a migração já citada em types.ts existir) + chatbot_treinamento
  formasPagamento?: string[];             // campo NOVO — não existe hoje, ver lacuna abaixo
  observacoes?:  string;                  // chatbot_config.faq (texto livre atual) como fallback transitório
};
```

### 5.2 Lacunas reais identificadas (não inventar, sinalizar)

- **Formas de pagamento**: não existe campo hoje em nenhuma tabela. Se a IA precisar responder isso, a resposta correta enquanto o campo não existir é "não tenho essa informação confirmada, posso te conectar com a equipe" — nunca supor.
- **`clinica_faq`**: já tem tipo definido (`DBFaq`) mas a tabela real depende de uma migration ainda não aplicada (comentário em `app/empresa/[slug]/_lib/types.ts:19`). Até lá, a Camada 3 usa `chatbot_treinamento` como fonte de perguntas/respostas customizadas — que já é real e funcional hoje.
- **`chatbot_config.convenios` / `.procedimentos`**: campos existentes, mas moram na tabela errada (são conhecimento de segmento, não config universal). Na migração (seção 9), viram entradas de `chatbot_treinamento` ou dado do módulo de Clínicas, não campos fixos da Camada 1.

### 5.3 Regra de isolamento (não negociável)

Toda função que monta `DadosEmpresa` recebe `clinica_id` como parâmetro obrigatório e toda query é filtrada por ele — igual ao padrão já usado em todo o resto do sistema (`clientes/page.tsx`, `dashboard/page.tsx`, etc.). Nenhuma camada acima (1, 2 ou 4) pode consultar o banco diretamente — só a Camada 3 toca dado, e só o dado do tenant autenticado.

---

## 6. Fluxo de decisão completo

```
1. Recebe mensagem (clinica_id, telefone, mensagem)
2. Camada 3: carrega DadosEmpresa(clinica_id)
     └─ se chatbot inativo ou sem config → não responde (igual ao comportamento atual)
3. Camada 1: classifica intenção universal
     ├─ intenção resolvida por template universal + DadosEmpresa
     │     └─ dado necessário existe? → responde
     │     └─ dado necessário NÃO existe? → "não tenho essa informação" + oferece humano
     ├─ intenção = "falar_com_humano" → encaminha (sempre disponível)
     └─ intenção = "intencao_especifica_segmento" → passa para Camada 2
4. Camada 2: módulo do segmento da empresa (resolvido por especialidade)
     ├─ frase bate com vocabulário do módulo → resposta do módulo (usando DadosEmpresa)
     └─ não bate com nada conhecido → volta para Camada 1 como "fora_do_escopo"
            → Camada 1 responde com esclarecimento ou encaminha humano
5. (Camada 4 não roda nesta fase — ver seção 8)
6. Log estruturado (mesmo padrão de chatbot_logs hoje) + resposta enviada via Z-API
```

Duas garantias explícitas no fluxo: (a) toda mensagem tem um destino final determinístico — nunca "cai no vazio"; (b) a Camada 2 nunca é a última palavra sem passar de volta pela garantia de esclarecimento/encaminhamento da Camada 1.

---

## 7. Estruturas de dados (treinamentos, intenções, exemplos, regras, prompts)

Estas cinco estruturas pedidas na missão são, na prática, quatro conceitos relacionados + um formato de prompt (só relevante quando/se uma camada de IA generativa for introduzida no futuro — hoje e nesta V1, zero IA generativa, 100% regras determinísticas, igual à filosofia já usada em `lib/recomendacoes.ts` e `lib/oportunidades-clientes.ts`).

### 7.1 Estrutura dos treinamentos
Já existe e está correta: `chatbot_treinamento { pergunta, resposta, palavras_chave, ativo, clinica_id }`. Continua sendo o mecanismo pelo qual **qualquer** empresa (independente de segmento) ensina algo específico do seu negócio sem precisar de um módulo novo. Um módulo de segmento pode **sugerir** treinamentos pré-prontos no onboarding (ex.: barbearia ganha sugestões de Q&A típicas para revisar e ativar) — mas o dono da empresa decide o que fica ativo.

### 7.2 Estrutura das intenções
```ts
type Intencao = {
  id: string;                 // ex.: "horario_funcionamento" ou "barbearia:corte_infantil"
  camada: 1 | 2;
  exemplosDeFrase: string[];  // usados para matching determinístico (mesmo mecanismo de palavras-chave já usado em matchTreinamento)
  requerDado?: string[];      // chaves de DadosEmpresa necessárias
  resolvedor: (empresa: DadosEmpresa) => string | null;
};
```

### 7.3 Estrutura dos exemplos
Cada intenção carrega uma lista de frases reais (curadas a partir de conversas de produção, como já é feito na Base Oficial de Conhecimento) — usadas tanto para o matching quanto como material de revisão humana quando uma intenção precisa ser ajustada. Mesma lógica de curadoria já usada nos dois documentos de base de conhecimento existentes (nada de gerar exemplo sintético sem revisão).

### 7.4 Estrutura das regras
Regras de segurança e estilo (seção 3.3) vivem como uma lista de validadores puros aplicados **depois** que qualquer camada gera uma resposta, antes do envio — um "pós-processamento" que pode barrar ou reescrever uma resposta que viole uma regra (ex.: menciona preço não cadastrado). Mesmo espírito de "motor de regras, nunca condicional espalhado" já estabelecido em `lib/recomendacoes.ts`.

### 7.5 Estrutura dos prompts
Não aplicável a esta fase (zero IA generativa). Documentado aqui só como contrato futuro: se uma camada generativa for introduzida (roadmap de Intelligence 3.0 já citado em `docs/organizapro-intelligence-engine-v1.html`), o prompt será montado assim — `promptSistema = núcleo universal (fixo) + vocabulário do módulo de segmento (injetado) + DadosEmpresa (injetado, nunca de outro tenant) + regras de segurança (fixas, no fim, como última instrução)` — para que trocar o "motor de decisão" por um modelo de linguagem não exija reescrever as camadas 2 e 3, só a forma como a Camada 1 monta a instrução final. Mesmo princípio já aplicado em `lib/recomendacoes.ts` ("a evolução com IA generativa vai substituir [só] este ponto").

---

## 8. Camada 4 — IA Comercial (arquitetura para roadmap, não implementar agora)

Contrato de extensão, para não bloquear a evolução futura sem comprometer nada agora:

```ts
type SinalComercial = {
  tipo: "follow_up" | "recuperacao_cliente" | "upsell" | "cross_sell" | "oportunidade_venda";
  origem: "conversa_chatbot" | "radar_de_oportunidades"; // ver lib/oportunidades-clientes.ts
  gatilho: (contexto: ContextoConversa) => boolean;
  acaoSugerida: string; // sempre uma sugestão para revisão humana nesta fase, nunca envio automático
};
```

**Ponte natural já existente:** o motor `lib/oportunidades-clientes.ts` (Radar de Oportunidades, já em produção) já resolve exatamente o tipo de sinal que a Camada 4 precisaria ("cliente sem retorno", "cancelamento sem reagendamento") — a IA Comercial futura reaproveitaria esse motor como uma das fontes de gatilho, em vez de recriar a lógica. Isso mantém a mesma diretriz já registrada em memória: nenhuma funcionalidade nova sem resolver um problema real, e reaproveitar antes de criar.

Nada disto é implementado agora — só a interface está aqui para que a Camada 1/2/3 já nasçam com um ponto de extensão limpo (nenhum retrabalho estrutural quando a Camada 4 for autorizada).

---

## 9. Estratégia de manutenção — uma única IA Universal

1. **Camada 1 é código único, versionado, testado como as demais engines do projeto** (mesmo padrão de teste standalone já usado para `lib/oportunidades-clientes.ts`). Mudança na Camada 1 afeta todos os tenants de uma vez — por isso ela só contém o que é *realmente* universal.
2. **Camada 2 é dado de configuração + pequenas funções puras por módulo**, não um app separado por segmento. Adicionar o 14º segmento é: criar um objeto `ModuloSegmento` novo, sem tocar em nenhum módulo existente (mesmo princípio de `lib/recomendacoes.ts`: "adicionar uma regra nova é só acrescentar um objeto ao array, nunca precisa tocar nas regras existentes").
3. **Camada 3 nunca guarda opinião, só dado.** Qualquer ajuste de tom/regra vive na Camada 1, nunca duplicado por empresa.
4. **Nenhum tenant nunca vê o vocabulário de outro segmento.** Validado automaticamente (seção 3.3) — não depende de revisão manual constante.
5. **Migração incremental, sem quebrar produção:**
   - Fase A: implementar Camada 1 (classificador + regras) rodando **em paralelo** ao `classificarTopico`/`montarResposta` atuais, com fallback para o comportamento antigo se algo não bater — zero risco de regressão.
   - Fase B: mapear `especialidade` → módulo para os segmentos com mais tenants primeiro (provavelmente Clínicas, já que é o legado do ClínicaFlow).
   - Fase C: aposentar `classificarTopico`/`montarResposta` só depois que a Camada 1+2 cobrir os mesmos casos com paridade confirmada.
   - Fase D (separada, requer decisão própria do Diretor): decidir se o funil SDR do OrganizaPro (`TENANT_SDR_ORGANIZAPRO`) migra para virar "só mais um módulo de segmento" (segmento = "venda de software B2B") ou continua isolado como está — não é bloqueador para lançar a IA Universal para os tenants normais.

---

## 10. O que esta entrega NÃO inclui (por escopo, não por esquecimento)

- Nenhuma alteração em `app/api/chatbot/message/route.ts` ou em qualquer tabela do Supabase.
- Nenhum módulo de segmento com código real — só o contrato (`ModuloSegmento`) e a tabela dos 13 segmentos com exemplos de intenção.
- Nenhuma IA generativa — mantém a mesma filosofia 100% determinística já usada no resto do "Diretor Digital".
- Nenhuma decisão sobre o futuro do funil SDR do OrganizaPro — fica como pergunta em aberto para quando a Fase D (seção 9) for discutida.

---

**Próximo passo:** aguardando aprovação desta arquitetura. Após aprovar, sugiro iniciar pela Fase A (Camada 1 rodando em paralelo, sem risco) como primeira etapa de implementação — mas essa também é uma decisão sua, não estou presumindo o próximo passo.
