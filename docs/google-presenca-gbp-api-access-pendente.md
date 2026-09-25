# Google Presença — conexão bloqueada por ACESSO À GBP API (pendente externo)

> **Status em 2026-09-25: BLOQUEIO EXTERNO.** Não é bug de OAuth, de código, de
> banco nem de escopo. O projeto Google Cloud `organizapro-509712` ainda **não
> foi aprovado** para as Business Profile APIs (quota 0). Nenhuma alteração de
> código, migration ou deploy resolve — só a aprovação do Google.
>
> Este documento existe porque **não havia nenhum registro no repositório** sobre
> a solicitação de acesso à GBP API (busca por "Basic API Access"/"GBP API
> contact form" em `docs/` retornava zero) e porque três arquivos citam um
> `docs/google-presenca-reputacao-ads-v1-arquitetura.md` que **não existe**
> (`lib/atribuicao-origem.ts`, `lib/motor-reputacao.ts`, `lib/presenca-digital.ts`).

## Sintoma

Fluxo: consentimento Google aceito → callback
`/api/google-business-profile/oauth/callback` → redireciona para
`/google-presenca?status=indisponivel`. Log:

```
[GBP OAuth] { codigo: 'INDISPONIVEL', httpGoogle: 429 }
```

## Causa raiz comprovável

1. **Endpoint/método que recusa**: `GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts`
   (Account Management API v1, `accounts.list`), chamado em
   `lib/google-business-profile-oauth.ts` → `listarContasGoogle()`
   (`lib/google-business-profile-api.ts`).
2. **Não é rate limit**: 300 QPM / 300 QPD por API; houve **uma** requisição,
   imediatamente após o consentimento, sem tráfego anterior no projeto.
3. **É quota 0 = acesso não concedido.** Documentação oficial do Google
   (*Quota limits*): "If your request exceeds a quota limit, the API responds
   with a 429… **If your quota limit for the Google Business Profile API is 0,
   you have not yet been granted access. Don't request a quota increase.
   Instead, submit the Application For Basic API Access.**"
   E (*Prerequisites*): "If your quota is 0 QPM… your project has not yet been
   approved. If your quota is set to 300 QPM, your project is approved."
4. **Confusão a evitar**: "a empresa já tem acesso à conta" (tela de
   consentimento) e "a API My Business Account Management está ativada no
   projeto" **não** significam projeto aprovado. Ativar as APIs é o passo
   *posterior* à aprovação.

### Diferenciador verificável no log (após a instrumentação de observabilidade)

Um 429 de quota zero chega com `reason: "RATE_LIMIT_EXCEEDED"` — **igual** a um
rate limit. Só o valor da quota distingue. O log passa a trazer:

```
[GBP OAuth] { codigo: 'INDISPONIVEL', httpGoogle: 429,
  diagnostico: { servico: 'mybusinessaccountmanagement.googleapis.com',
    statusGoogle: 'RESOURCE_EXHAUSTED', razao: 'RATE_LIMIT_EXCEEDED',
    quota: { metrica: '…/requests', limite: 'Requests per minute', valor: '0' },
    mensagem: 'Quota exceeded for quota metric … [redigido]' },
  causa: 'ACESSO_GBP_NAO_CONCEDIDO' }
```

`causa: ACESSO_GBP_NAO_CONCEDIDO` só é emitida quando
`quota.valor === "0"`. Sem quota explícita, nenhum 429 é classificado como
acesso negado nem como rate limit (`lib/google-business-profile-errors.ts`).

## Ação externa necessária (única forma de conectar)

1. **Conferir a quota (somente leitura)**: Google Cloud Console → projeto
   `organizapro-509712` → APIs & Services → Business Profile APIs → **Quotas**.
   `0 QPM` = não aprovado; `300 QPM` = aprovado.
2. **Submeter "Application for Basic API Access"** pelo *GBP API contact form*,
   informando:
   - **Project Number** do `organizapro-509712` (Project info → Dashboard);
   - e-mail que seja **owner/manager do perfil** (recomendado: mesmo domínio
     `organizaprooficial.com.br`);
   - nome da empresa e o perfil GBP usado.
3. **Pré-requisitos do Google**: perfil **verificado e ativo há 60+ dias** e
   **site da empresa** publicado no perfil (aqui, `organizaprooficial.com.br`).
4. **Revisão: até 14 dias**, com e-mail de retorno; a aprovação também é
   visível na quota (0 → 300 QPM).
5. **NÃO** pedir aumento de quota (o Google instrui o contrário quando a quota
   é 0) e **não** tentar contornar a restrição por código.

### Verificação secundária pendente (não executável localmente)

O prefixo numérico do **OAuth Client ID** é o *project number* que está sendo
cobrado na quota. Se o client de produção pertencer a um projeto **diferente**
do aprovado, o 429 continua mesmo após a aprovação. Essa checagem precisa ser
feita no **Vercel** (env `GOOGLE_BUSINESS_PROFILE_CLIENT_ID`) — o `.env.local`
deste checkout não contém nenhuma chave Google. O log instrumentado mostra o
`project_number` do consumidor dentro da mensagem sanitizada, o que fecha a
verificação de forma definitiva.

## Depois da aprovação (ordem obrigatória)

1. *Basic setup*: habilitar as APIs do Business Profile no projeto aprovado.
2. Rodar **um** teste OAuth real (Administração → Presença → Conectar Google).
3. Sucesso esperado: `?status=connected` + `google_business_profile_connections`
   com `google_account_name`/`google_location_name` gravados.
4. Se voltar `indisponivel`, ler `causa`/`diagnostico` no log antes de qualquer
   nova tentativa.

## Escopo deste pendente

Nada aqui exige migration/SQL: a persistência GBP está convergida. Nada exige
alterar Vercel, Google Cloud, credenciais ou cobrança nesta etapa — os passos 1
e 2 acima são **ações humanas** no console/formulário do Google.

Referências oficiais: *Business Profile APIs → Quota limits* e *Prerequisites*
(developers.google.com/my-business/content/limits e /prereqs).
