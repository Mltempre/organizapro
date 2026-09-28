# WhatsApp + Chatbot — Implantação de cliente (V1)

Procedimento canônico para colocar o WhatsApp e o chatbot do OrganizaPro no ar
para um cliente novo. Siga as fases **na ordem**. Não pule a fase J: é ela que
libera mensagens automáticas para os clientes finais.

> Nunca escreva segredos neste documento, em tickets ou em conversas.
> Valores entre `<...>` são placeholders.

---

## Regra de ouro

**WhatsApp conectado ≠ automações ativas.**

Salvar as credenciais Z-API **não** envia nada sozinho. Lembretes e pedidos de
avaliação só saem depois do botão **▶ Ativar automações** (Configurações →
Integração WhatsApp). Até lá você pode conectar, testar chatbot, testar
atendimento humano e conferir logs com segurança.

---

## Pré-requisitos (checklist)

- [ ] Contrato fechado e negócio definido (nome, segmento, endereço, horário).
- [ ] Um **número WhatsApp Business exclusivo do negócio**, em aparelho do
      cliente (nunca número pessoal, nunca o número do OrganizaPro).
- [ ] Aparelho com o WhatsApp Business aberto e internet estável para ler o QR Code.
- [ ] Acesso à conta Z-API **do OrganizaPro** (a instância é criada na nossa conta).
- [ ] Acesso de administrador ao OrganizaPro (para criar o negócio e o usuário).
- [ ] Um celular de teste externo (que não seja o do negócio) para os testes.
- [ ] Na Vercel (uma vez só, já feito para o produto): `WEBHOOK_SECRET`,
      `CHATBOT_INTERNAL_SECRET`, `INTERNAL_SERVICE_SECRET`, `CRON_SECRET`,
      `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` configuradas.

## Nunca reutilizar entre clientes

- Instância Z-API (Instance ID), token da instância e Security Token.
- Número de WhatsApp / aparelho.
- Usuário de login do OrganizaPro.
- `link_humano` de outro negócio.
- **A instância do OrganizaPro Oficial** — nunca como “quebra-galho” para cliente.

Instância repetida em dois negócios é recusada pela tela de Configurações
(“Esta instância Z-API já está vinculada a outro negócio”). Se por outro caminho
duas empresas ficarem com a mesma instância, o sistema **para de responder as
duas** (proteção fail-closed) até a duplicidade ser desfeita.

---

## FASE A — Preparar o negócio (tenant)

1. Criar o negócio no OrganizaPro (produto **OrganizaPro**) com o segmento
   correto (ex.: barbearia, clínica, oficina). O segmento define as respostas
   específicas do chatbot.
2. Criar o usuário do cliente e vinculá-lo ao negócio (vínculo ativo).
3. Entrar com esse usuário e abrir **Configurações**. Preencher:
   Nome do Negócio, **WhatsApp** (o número do negócio, com DDD), Email,
   Endereço, Horário de Atendimento, Link de Avaliação no Google (se houver).
4. Revisar as “Mensagens Automáticas” (lembrete, confirmação, avaliação,
   reagendamento). Clicar **Salvar**.

✅ Resultado: em Integração WhatsApp o painel mostra
`WhatsApp (Z-API): ○ Não configurado · Chatbot: ○ Desativado · Automações: ○ Desativadas`.

## FASE B — Preparar o WhatsApp Business do cliente

1. Instalar/abrir o **WhatsApp Business** no aparelho do cliente com o número do negócio.
2. Completar o perfil comercial (nome, endereço, horário).
3. **Desligar** mensagens automáticas nativas do WhatsApp Business (saudação e
   ausência) — elas duplicariam as respostas do chatbot.

## FASE C — Criar a instância Z-API

1. No painel Z-API **do OrganizaPro**, criar uma instância nova com o nome
   `<nome-do-negócio>`.
2. Anotar (somente para colar no OrganizaPro, em seguida): **Instance ID**,
   **Token da instância** e **Security Token (Client-Token)**.

## FASE D — QR Code

1. No painel da instância, gerar o QR Code.
2. No aparelho do cliente: WhatsApp Business → Aparelhos conectados →
   Conectar aparelho → ler o QR Code.
3. Confirmar no painel Z-API que a instância está **Conectada**.

## FASE E — Webhook (callback)

1. No painel da instância → Webhooks, no campo **“Ao receber”**, colar:
   `https://www.organizaprooficial.com.br/api/webhook/zapi?token=<WEBHOOK_SECRET>`
   (o valor de `<WEBHOOK_SECRET>` é o mesmo configurado na Vercel; peça a quem
   administra a Vercel — nunca envie por chat aberto).
2. Deixar os demais webhooks vazios. “Notificar as enviadas por mim” é
   opcional: o sistema ignora mensagens enviadas pelo próprio número.
3. No OrganizaPro → Configurações → Integração WhatsApp: colar **Instance ID**,
   **Token** e **Security Token** → **Salvar**.

✅ Resultado: `WhatsApp (Z-API): ● Configurado`, `Automações: ○ Desativadas`
(continua desativado — correto nesta fase).

## FASE F — Chatbot

Menu **Chatbot** → aba Configuração:

1. Nome do Negócio (aparece na saudação).
2. **Link WhatsApp Humano**: opcional. Se preenchido (ex.: `https://wa.me/<número-da-recepção>`),
   é enviado quando o cliente pede atendente. Se vazio, o bot avisa que a
   equipe continua **por este mesmo WhatsApp**.
3. Horário de funcionamento e Endereço (o bot só responde o que estiver aqui —
   nunca inventa).
4. Convênios, procedimentos e perguntas frequentes, se aplicável.
5. Aba **Treinamento**: cadastrar respostas por palavra-chave para as dúvidas
   mais comuns do negócio (preços só se o cliente autorizar por escrito).
6. Ligar **Chatbot Ativo** e salvar.

✅ Em Configurações o painel passa a mostrar `Chatbot: ● Ativo`.

## FASE G — Teste inbound (entrada)

Do **celular de teste externo**, mandar “Olá” para o número do negócio.

- Esperado: 1 resposta automática com o nome do negócio.
- Chatbot → Histórico: aparece a conversa (conteúdo omitido por privacidade).
- Perguntar “qual o endereço?” e “qual o horário?” — respostas iguais ao cadastrado.

## FASE H — Teste de atendimento humano (handoff)

Do celular de teste, mandar **“quero falar com um atendente”**.

- Esperado: 1 resposta de encaminhamento para a equipe (ou o link humano).
- Histórico: selo **“👤 Passou para a equipe · bot pausado 24h”**.
- Mandar mais 2 mensagens: **nenhuma resposta do bot**; no histórico, selo
  **“👤 Equipe atendendo · sem resposta do bot”**.
- A equipe responde pelo aparelho/WhatsApp Web normalmente.
- Após 24h sem novo pedido, o bot volta a responder esse contato.

Outros gatilhos que também pausam o bot: “humano”, “atendimento humano”,
“recepcionista”, “falar com alguém / uma pessoa / a equipe / vocês / um
especialista / o responsável”; e, no segmento psicologia, sinais de crise.

## FASE I — Teste outbound (saída)

Em Configurações → Integração WhatsApp → **🧪 Enviar mensagem de teste**.

- O teste só envia para o **WhatsApp salvo do negócio** (campo “WhatsApp” da
  fase A) — nunca para número digitado na hora.
- Esperado: “✅ Teste OrganizaPro: integração Z-API funcionando corretamente!”
  chega no aparelho do negócio.
- Um teste por hora: repetir na mesma hora mostra aviso (proteção contra envio duplicado).

| Mensagem na tela | O que fazer |
|---|---|
| Mensagem de teste enviada… | Conferir o aparelho. |
| O teste só envia para o WhatsApp salvo do negócio… | Salvar as configurações e repetir. |
| Já houve um teste nesta hora… | Conferir o aparelho; repetir na próxima hora. |
| WhatsApp não configurado… | Preencher as 3 credenciais e salvar. |
| A Z-API não confirmou o envio… | Ver no painel Z-API se a instância está Conectada; ver o aparelho antes de repetir. |

## FASE J — Ativar automações

Somente depois de G, H e I aprovados:

1. Conferir agenda do negócio (compromissos de amanhã com telefone correto).
2. Configurações → Integração WhatsApp → **▶ Ativar automações** → confirmar.
3. Painel: `Automações: ● Ativas`.

O que passa a acontecer:

- **Lembretes**: todo dia às **18h (Brasília)**, para compromissos do dia
  seguinte, pedindo resposta SIM. SIM confirma; NÃO marca para reagendar.
- **Avaliações**: todo dia às **20h (Brasília)**, para atendimentos concluídos
  nos últimos 7 dias, se houver Link de Avaliação do Google. Na primeira
  ativação, atendimentos mais antigos que 7 dias são silenciados (sem envio em massa).

Respostas SIM/NÃO do cliente a um compromisso pendente são tratadas mesmo com
automações desativadas (são resposta a uma mensagem do próprio cliente).

## FASE K — Verificar logs

- **Chatbot → Histórico**: cada resposta do bot, handoffs e “limite de respostas/hora”.
- Envios (teste, lembretes, avaliações, respostas) ficam em `whatsapp_logs`
  (consulta pela equipe técnica): status `enviado` ou `erro`, sempre sem o
  conteúdo da mensagem.
- Nenhum log mostra token, segredo ou URL do webhook.

## FASE L — Entregar ao cliente

Explicar ao cliente, em 5 minutos:

1. O bot responde dúvidas simples e passa para a equipe quando pedem atendente.
2. Depois do pedido de atendente, o bot fica **24h em silêncio** com aquele
   cliente — a equipe precisa responder pelo aparelho.
3. Onde ligar/desligar o chatbot (Chatbot → Chatbot Ativo) e as automações
   (Configurações → Desativar automações).
4. Áudio e foto não são respondidos pelo bot — a equipe responde.
5. Nunca desconectar o WhatsApp Web da Z-API no aparelho.

---

## Situações especiais

### Contato com número oculto (`@lid`)
O WhatsApp pode esconder o número de alguns contatos (identificador `@lid`), e a
Z-API não converte `@lid` em telefone. Nesses casos o sistema **não responde
automaticamente** e **não associa a conversa a nenhum cliente** (fica só um
registro técnico sem telefone). A equipe atende pelo aparelho normalmente.

### Áudio, foto, figurinha, documento
Sem resposta automática, sem erro e sem loop. A equipe responde pelo aparelho.
(Transcrição/leitura de imagem não fazem parte da V1.)

### Cliente pede para não receber mais
“parar”, “pare”, “sair”, “stop”, “cancelar inscrição”, “descadastrar”,
“não quero mais receber”, “remover meu número/contato”: o contato é bloqueado
para envios automáticos e nenhum agendamento é alterado.

### Anti-loop
Máximo de **15 respostas do bot por contato por hora**. Acima disso o bot para
com aquele contato (selo “Limite de respostas/hora”). Protege contra outro robô
conversando com o nosso.

### Z-API offline / instância desconectada
- Sintoma: teste mostra “A Z-API não confirmou o envio”; bot não responde.
- Ação: painel Z-API → instância → reconectar (FASE D). Conferir o aparelho
  antes de repetir qualquer envio — o sistema **não reenvia sozinho** mensagens
  com resultado incerto (evita duplicidade).
- Se durar: **Desativar automações** até normalizar.

### Webhook não chega (cliente manda mensagem e nada acontece)
1. Chatbot está Ativo? (painel de Configurações)
2. A instância está Conectada no painel Z-API?
3. O webhook “Ao receber” está exatamente com a URL da FASE E, com o `token`?
4. O Instance ID salvo no OrganizaPro é o mesmo da instância?
5. O contato pediu atendente nas últimas 24h? (bot pausado — ver histórico)
6. O contato tem número oculto (`@lid`)? (não respondível automaticamente)
7. Persistindo: acionar a equipe técnica com data/hora da mensagem de teste
   (nunca enviar segredos).

### Como desativar o chatbot
Chatbot → aba Configuração → desligar **Chatbot Ativo** → salvar. Mensagens
continuam chegando; nenhuma resposta automática.

### Como desativar as automações
Configurações → Integração WhatsApp → **⏸ Desativar automações** → confirmar.
Lembretes e avaliações param no próximo ciclo; chatbot não é afetado.

### Rollback operacional (do mais leve ao mais forte)
1. **Desativar automações** (para envios programados).
2. **Desativar chatbot** (para respostas automáticas).
3. No painel Z-API, **apagar a URL do webhook “Ao receber”** (o OrganizaPro
   deixa de receber mensagens dessa instância).
4. **Desconectar a instância** no painel Z-API (para qualquer envio).
Nada disso apaga dados do cliente.

---

## Testes reais de homologação (somente com GO do responsável, após deploy)

| Teste | Passos | Esperado |
|---|---|---|
| **A — Entrada + resposta** | Celular externo manda “Olá” ao número do negócio | 1 resposta do bot; histórico com a conversa; `whatsapp_logs` com 1 `enviado` no negócio certo |
| **B — Saída controlada** | Configurações → Enviar mensagem de teste (número salvo autorizado) | Mensagem de teste chega; repetir na mesma hora → aviso, sem duplicar |
| **C — Handoff + silêncio** | “quero falar com um atendente”, depois 2 mensagens | 1 resposta de encaminhamento; depois nenhuma; selos de handoff no histórico |
| **D — Chatbot desligado** | Desligar Chatbot Ativo; celular externo (sem compromisso pendente) manda “Olá” | Nenhuma resposta automática |
| **E — Automações desligadas** | Com automações desativadas e compromisso amanhã, aguardar 18h | Nenhum lembrete enviado para esse negócio; após ativar, o próximo ciclo envia |

---

## Checklist final — PRONTO PARA ENTREGAR

- [ ] Negócio com produto OrganizaPro, segmento correto e usuário vinculado.
- [ ] Número exclusivo do negócio; mensagens automáticas nativas do WhatsApp Business desligadas.
- [ ] Instância Z-API própria, **Conectada**, criada na conta do OrganizaPro.
- [ ] Webhook “Ao receber” com a URL correta (com `token`).
- [ ] Configurações salvas; painel: WhatsApp **Configurado**.
- [ ] Chatbot configurado (nome, horário, endereço, link humano) e **Ativo**.
- [ ] Teste G (entrada) aprovado.
- [ ] Teste H (atendente + silêncio) aprovado.
- [ ] Teste I (saída) aprovado.
- [ ] Automações **ativadas deliberadamente** (fase J) — ou mantidas desativadas por decisão do cliente.
- [ ] Logs conferidos (fase K), sem nenhum segredo exposto.
- [ ] Cliente orientado (fase L).

---

## Pendente de decisão (não bloqueia a implantação)

- SQL `sql/saneamento-pendente/fix-clinica-config-zapi-instance-unica-v1.sql`:
  unicidade estrutural de `zapi_instance` no banco. **Não aplicado** — tabela
  compartilhada com o ClínicaFlow; aplicar somente com GO. A tela de
  Configurações já recusa instância duplicada.

## Fora da V1 (futuro)

Transcrição de áudio, leitura de imagem, inbox de WhatsApp, campanhas em massa,
segredo de webhook individual por negócio, retomada antecipada do bot antes das 24h.
