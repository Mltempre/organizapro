# Biblioteca Universal de Treinamentos — IA Universal do OrganizaPro

**Status: ✅ HOMOLOGADA** (decisão do Diretor, 2026-07-25). A partir de agora, esta é a **Biblioteca Mestre** — todo módulo de segmento (Fase 3) reutiliza o que está aqui e só acrescenta o que é específico do segmento. Nenhum segmento "reensina" saudação, regra de segurança ou cenário de transferência — isso já está resolvido nesta biblioteca, uma única vez, para sempre.

**Como isto se conecta ao código já commitado (Fase 1, `lib/ia-universal/`):** as 16 intenções abaixo são a referência de conteúdo; a tabela da seção 1 mostra onde cada uma já existe na Camada 1 implementada e onde é mais granular que o código atual.

## 0. Estrutura da Biblioteca Mestre (índice de referência)

```
IA UNIVERSAL
├── Intenções .................... seção 1  (16 intenções, mapeadas ao código da Fase 1)
├── Exemplos
│      ├── Formal, Informal, Gírias, Erros, Emojis ... seção 2 (320 exemplos reais, 20/intenção,
│      │                                                        já mesclando os 5 estilos)
│      └── Catálogo de variações reutilizável ......... seção 3 (abreviações, erros, emojis, tamanho)
├── Regras
│      ├── Nunca inventar ......... seção 5 (4 regras negativas)
│      ├── Confirmar .............. seção 4 (respostas base — todas pedem confirmação, nunca afirmam
│      │                                     algo que dependa de dado ausente)
│      └── Escalar ................ seção 6 (cenários de transferência)
├── Segurança ..................... seção 5 + regra de isolamento comercial já em `lib/ia-universal/camada1-universal.ts`
├── Transferência ................. seção 6
└── Respostas Base ................ seção 4
```

Esta árvore é a referência oficial a partir de agora — cada módulo de segmento (Fase 3) é avaliado contra ela: o que falta é *só* vocabulário e intenções adicionais do segmento, nunca uma reconstrução de saudação/regra/transferência.

---

## 1. Intenções Universais — mapeamento com a Camada 1 já implementada

| # | Intenção (Fase 2) | Descrição | Já existe na Camada 1 (Fase 1)? |
|---|---|---|---|
| 1 | Saudação | Cliente inicia a conversa | `saudacao` — igual |
| 2 | Despedida | Cliente encerra a conversa | `despedida` — igual |
| 3 | Agendamento | Cliente quer marcar um novo horário | `agendar` — igual |
| 4 | Reagendamento | Cliente quer mudar um horário já marcado | `reagendar_cancelar` — hoje junto com Cancelamento |
| 5 | Cancelamento | Cliente quer cancelar um horário já marcado | `reagendar_cancelar` — hoje junto com Reagendamento |
| 6 | Horário | Cliente pergunta o horário de funcionamento | `horario_funcionamento` — igual |
| 7 | Endereço | Cliente pergunta a localização | `endereco_localizacao` — igual |
| 8 | Telefone | Cliente pede um número de telefone | **novo** — hoje cai em `falar_com_humano` (usa `linkHumano`) |
| 9 | WhatsApp | Cliente pergunta sobre o canal/número de WhatsApp | **novo** — hoje cai em `fora_do_escopo` |
| 10 | Serviços | Cliente pergunta o que a empresa oferece | **novo** — hoje é só tratado dentro dos módulos de segmento (Camada 2), não como intenção universal |
| 11 | Orçamento | Cliente pede um orçamento específico (não só "quanto custa") | **novo** — próximo de `duvida_preco_generica`, mas pede algo mais formal/detalhado |
| 12 | Formas de contato | Cliente pergunta canais alternativos (e-mail, Instagram, etc.) | **novo** — hoje cai em `fora_do_escopo` |
| 13 | Dúvidas gerais | Pergunta genérica, sem assunto específico ainda | **novo** — próximo do antigo `fora_do_escopo`, mas com intenção de pergunta explícita ("tenho uma dúvida") |
| 14 | Reclamações | Cliente relata insatisfação | `elogio_reclamacao` — hoje junto com Elogios |
| 15 | Elogios | Cliente demonstra satisfação | `elogio_reclamacao` — hoje junto com Reclamações |
| 16 | Falar com atendente | Cliente pede atendimento humano explicitamente | `falar_com_humano` — igual |

**Observação sobre a divisão Reclamação/Elogio e Reagendamento/Cancelamento:** o código da Fase 1 uniu esses pares porque a *resposta* de abertura é parecida nos dois lados (agradecer/reconhecer, depois agir) — mas o conteúdo abaixo já separa os exemplos por não terem o mesmo objetivo de negócio (reclamação quase sempre pede escalonamento; elogio não). Fica registrado para quando a Camada 1 for refinada.

---

## 2. Exemplos reais por intenção (20 por intenção)

Cada lista já mistura, de propósito, mensagem formal, informal, curta, longa, com abreviação, com erro comum de português e com emoji — não é uma lista "limpa", é como cliente real escreve.

### 2.1 Saudação
1. Oi
2. Olá
3. Bom dia
4. Boa tarde
5. Boa noite
6. Oii, tudo bem?
7. Tem alguém aí?
8. Alguém pode me ajudar?
9. Queria conversar
10. opa
11. e aí
12. oi td bem
13. bom dia!!
14. Oii
15. oi pessoal
16. alô
17. oi, queria falar com vcs
18. bom dia, tudo bem por aí?
19. 👋
20. oiee, alguém disponível?

### 2.2 Despedida
1. Tchau
2. Até mais
3. Obrigado
4. Obrigada
5. Valeu
6. Falou
7. flw
8. Até logo
9. Obrigado, viu
10. Brigadão
11. valeuu
12. Até breve
13. tchauzinho
14. obg
15. vlw flw
16. até
17. Agradeço
18. Muito obrigado pela atenção
19. Ok, obrigado
20. 👍 obrigado

### 2.3 Agendamento
1. Quero agendar um horário
2. Gostaria de marcar um horário
3. Tem horário disponível essa semana?
4. Quero marcar para amanhã
5. Dá pra marcar pra sexta-feira?
6. Queria agendar, tem vaga?
7. Consigo marcar para hoje?
8. Preciso agendar um atendimento
9. Vcs têm horário livre amanhã?
10. Quero fazer um agendamento
11. Como faço pra marcar?
12. Queria reservar um horário
13. Tem vaga pra próxima semana?
14. Quero agendar, pode ser de manhã?
15. Bom dia, quero marcar um horário
16. Tem como encaixar hoje?
17. Preciso de um horário urgente, tem vaga?
18. Quero marcar, qual o próximo disponível?
19. Da pra agendar pra sabado?
20. Oi, queria saber se tem horário pra essa semana

### 2.4 Reagendamento
1. Quero remarcar meu horário
2. Preciso mudar o horário
3. Dá pra trocar meu horário?
4. Quero mudar a data do meu atendimento
5. Posso remarcar pra outro dia?
6. Preciso reagendar
7. Vcs conseguem me encaixar em outro dia?
8. Quero mudar meu horário marcado
9. Dá pra passar pra semana que vem?
10. Preciso trocar o dia do meu atendimento
11. Posso remarcar? Surgiu um imprevisto
12. Quero mudar meu horario de amanha
13. Dá pra adiantar meu horário?
14. Posso antecipar o atendimento?
15. Quero remarcar pra sexta
16. Preciso mudar a hora do meu horário
17. Não vou conseguir no horário marcado, quero remarcar
18. Dá pra mudar de manhã pra tarde?
19. Quero remarcar meu horário de hoje
20. Preciso adiar meu atendimento

### 2.5 Cancelamento
1. Quero cancelar meu horário
2. Preciso desmarcar
3. Infelizmente vou ter que cancelar
4. Não vou poder ir, pode cancelar?
5. Preciso cancelar por um imprevisto
6. Quero cancelar meu agendamento de amanhã
7. Dá pra cancelar meu horário?
8. Cancela meu horário de hoje, por favor
9. Vou ter que desmarcar, surgiu um imprevisto
10. Preciso cancelar, não vou conseguir ir
11. Quero desmarcar meu atendimento
12. Cancelar meu horário das 15h
13. Não conseguirei comparecer, pode cancelar?
14. Preciso cancelar por motivo de saúde
15. Quero cancelar, vou remarcar depois
16. Cancela pra mim, por favor
17. Infelizmente preciso cancelar hoje
18. Quero desmarcar o meu de amanhã
19. Cancelar, não vou poder ir
20. Bom dia, preciso cancelar meu horário

### 2.6 Horário
1. Qual o horário de vocês?
2. vc abre hj?
3. Que horas vocês abrem?
4. Até que horas funciona?
5. Vocês atendem aos sábados?
6. Qual horário de atendimento?
7. Vocês abrem domingo?
8. Funciona de que horas até que horas?
9. Qual o horario de vcs
10. tem horario?
11. Que horas fecha?
12. Tá aberto agora?
13. Qual horario voces atendem
14. Vcs abrem feriado?
15. Horário de funcionamento, por favor
16. Que horas vcs começam?
17. Até que hora dá pra ir aí?
18. Vcs trabalham hoje?
19. Qual o expediente de vocês?
20. Abre de manhã?

### 2.7 Endereço
1. Qual o endereço?
2. Onde fica?
3. Qual a localização de vocês?
4. Como chego aí?
5. Qual o endereço de vcs
6. Onde vocês ficam?
7. Manda a localização, por favor
8. Qual rua vocês ficam?
9. Tem endereço no Google?
10. Onde é o local?
11. Qual o endereço completo?
12. Pode mandar a localização?
13. Onde fica exatamente?
14. Qual bairro vocês ficam?
15. Manda o link do mapa
16. Onde vcs estão localizados?
17. Qual o CEP de vocês?
18. Fica perto de onde?
19. Endereço pra eu ir aí
20. Onde é pra chegar?

### 2.8 Telefone
1. Qual o telefone de vocês?
2. Tem telefone fixo?
3. Qual o número pra ligar?
4. Posso ligar pra vocês?
5. Qual o telefone de contato?
6. Tem outro número além do WhatsApp?
7. Qual o fixo de vocês?
8. Me passa o telefone
9. Qual número eu ligo?
10. Tem telefone da loja?
11. Qual o contato telefônico?
12. Posso ligar agora?
13. Qual o número fixo?
14. Me manda o telefone
15. Tem telefone comercial?
16. Qual o DDD de vocês?
17. Telefone para contato, por favor
18. Qual número de telefone vcs tem
19. Vcs tem telefone?
20. Me passa um número pra ligar

### 2.9 WhatsApp
1. Qual o WhatsApp de vocês?
2. Esse é o número certo?
3. Posso mandar mensagem aqui mesmo?
4. É esse o WhatsApp oficial?
5. Vocês atendem por aqui mesmo?
6. Esse WhatsApp é só automático?
7. Posso falar por aqui?
8. Esse número é de vocês mesmo?
9. Vocês respondem por WhatsApp?
10. Dá pra resolver tudo por aqui?
11. É nesse WhatsApp que eu falo com vocês?
12. Posso mandar foto aqui?
13. Vocês usam esse WhatsApp pra quê?
14. Esse é o WhatsApp da empresa?
15. Posso confirmar por aqui mesmo?
16. Vocês têm outro WhatsApp?
17. Esse número funciona 24h?
18. Posso te mandar um áudio?
19. Dá pra resolver td por wpp
20. É aqui que eu confirmo presença?

### 2.10 Serviços
1. Quais serviços vocês oferecem?
2. O que vocês fazem?
3. Quais são os serviços?
4. Vcs fazem o quê exatamente?
5. Me fala o que vocês oferecem
6. Quais os serviços disponíveis?
7. O que tem disponível aí?
8. Quais tipos de atendimento vcs fazem?
9. Me explica o que vocês fazem
10. Quero saber o que vocês oferecem
11. Quais opções vocês têm?
12. Tem lista de serviços?
13. Quais serviços estão disponíveis?
14. O que vcs trabalham?
15. Me manda os serviços de vocês
16. Quais atendimentos vcs realizam?
17. Quero saber mais sobre os serviços
18. Tem catálogo de serviços?
19. O que exatamente vcs fazem aí?
20. Vocês fazem [algo específico]?

### 2.11 Orçamento
1. Quero um orçamento
2. Quanto fica no total?
3. Pode me passar um orçamento?
4. Quero saber o valor total
5. Me manda um orçamento, por favor
6. Quanto custaria pra mim?
7. Quero fazer um orçamento
8. Pode orçar pra mim?
9. Preciso de um orçamento detalhado
10. Quanto ficaria isso?
11. Me dá uma estimativa de valor
12. Quero saber quanto vai custar
13. Pode me passar os valores?
14. Preciso de um orçamento pra hoje
15. Quanto sai no total?
16. Me manda o orçamento completo
17. Quero comparar valores antes
18. Pode fazer um orçamento sem compromisso?
19. Quanto ficaria o pacote completo?
20. Preciso do orçamento por escrito

### 2.12 Formas de contato
1. Como faço pra falar com vocês?
2. Quais os canais de atendimento?
3. Só tem esse WhatsApp?
4. Tem e-mail pra contato?
5. Como entro em contato com vcs?
6. Qual a melhor forma de falar com vocês?
7. Vocês têm Instagram?
8. Tem outro jeito de contatar vocês?
9. Qual rede social vocês usam?
10. Como faço contato fora do WhatsApp?
11. Tem site pra eu ver mais?
12. Qual e-mail de vocês?
13. Como faço pra falar direto com alguém?
14. Vocês atendem por outros canais?
15. Tem telefone além do WhatsApp?
16. Qual o Instagram de vocês?
17. Tem Facebook?
18. Como acho vocês na internet?
19. Qual a melhor forma de contato?
20. Vocês respondem e-mail?

### 2.13 Dúvidas gerais
1. Tenho uma dúvida
2. Queria tirar uma dúvida
3. Pode me ajudar com uma informação?
4. Tenho uma pergunta
5. Queria entender melhor como funciona
6. Pode me explicar como funciona?
7. Tenho uma dúvida rápida
8. Será que vcs podem me ajudar?
9. Queria uma informação
10. Uma dúvida rapidinha
11. Pode esclarecer uma coisa pra mim?
12. Gostaria de entender o processo
13. Tenho algumas perguntas
14. Será que dá pra tirar uma dúvida?
15. Queria saber como funciona isso
16. Pode me dar mais detalhes?
17. Uma perguntinha rápida
18. Será que vocês podem esclarecer?
19. Gostaria de mais informações
20. Tenho uma dúvida sobre o atendimento

### 2.14 Reclamações
1. Fiquei insatisfeito com o atendimento
2. Quero reclamar
3. O atendimento foi péssimo
4. Não gostei do que aconteceu
5. Isso não é sério
6. Muito ruim o atendimento de vocês
7. Quero fazer uma reclamação
8. Isso foi horrível
9. Esperei muito e ninguém me atendeu
10. Fiquei muito chateado com isso
11. O serviço não ficou bom
12. Quero registrar uma reclamação
13. Isso é um absurdo
14. Muito decepcionado com vocês
15. O atendimento deixou a desejar
16. Isso não deveria acontecer
17. Quero uma explicação sobre o ocorrido
18. Fiquei bem insatisfeito
19. Não recomendo pra ninguém do jeito que foi
20. Isso precisa ser resolvido urgente

### 2.15 Elogios
1. Adorei o atendimento
2. Parabéns pelo trabalho
3. Ficou perfeito, obrigado
4. Muito bom o atendimento de vocês
5. Excelente serviço
6. Gostei muito
7. Vocês são ótimos
8. Super indico vocês
9. Atendimento nota 10
10. Fiquei muito satisfeito
11. Adorei o resultado
12. Vocês são incríveis
13. Muito profissionais
14. Superou minhas expectativas
15. Ficou show
16. Parabéns pela qualidade
17. Recomendo demais
18. Atendimento impecável
19. Gostei bastante do resultado
20. Vocês merecem 5 estrelas ⭐

### 2.16 Falar com atendente
1. Quero falar com uma pessoa
2. Quero falar com um atendente
3. Isso aqui é um robô?
4. Quero falar com humano
5. Alguém pode me atender de verdade?
6. Isso é automático?
7. Quero falar com alguém de verdade
8. Poderia me transferir pra um atendente?
9. Não quero falar com robô
10. Quero um atendimento humano
11. Tem alguém real aí?
12. Pode me passar pra uma pessoa?
13. Quero conversar com alguém da equipe
14. Isso é uma IA?
15. Prefiro falar com uma pessoa
16. Quero falar direto com vocês
17. Pode chamar um atendente?
18. Isso é chatbot?
19. Quero suporte humano
20. Me coloca com alguém de verdade

---

## 3. Variações de linguagem (catálogo, reutilizável em qualquer intenção)

### 3.1 Abreviações comuns observadas
| Abreviação | Forma completa |
|---|---|
| vc, vcs | você, vocês |
| td, tds | tudo, todos |
| hj | hoje |
| pq | porque / por quê |
| blz | beleza |
| vlw | valeu |
| flw | falou |
| qdo | quando |
| qto | quanto |
| msg | mensagem |
| add | adicionar |
| obg | obrigado(a) |
| p/ | para |
| c/ | com |
| s/ | sem |
| dps | depois |
| td bem | tudo bem |
| n | não |
| e | é (confundido com a conjunção "e") |

### 3.2 Erros comuns de português observados
- Ausência de acento: "voce", "esta", "horario", "endereco", "ate", "sabado".
- Confusão "mas"/"mais": "eu mas queria saber".
- Confusão "onde"/"aonde": usadas indistintamente — tratar como equivalentes.
- Falta de concordância: "vocês tem horário", "os cliente".
- Pontuação ausente ou excessiva: "oi tudo bem" (sem vírgula), "quero saber!!!!".
- Letra maiúscula só no meio da frase ou ausente no início.

### 3.3 Emojis mais comuns em cada categoria
- Saudação/despedida: 👋 🙂 😊
- Confirmação/positivo: 👍 ✅ 🙏
- Elogio: ⭐ 😍 🔥
- Reclamação: 😡 👎 😞
- Dúvida: 🤔 ❓

### 3.4 Padrão de tamanho de mensagem
- **Curtas (1–3 palavras):** "oi", "quanto custa?", "tem horário?" — mais comuns em saudação, dúvida de preço, horário.
- **Médias (4–10 palavras):** a maioria dos exemplos acima.
- **Longas (11+ palavras):** mais comuns em reclamações e dúvidas gerais, onde o cliente contextualiza a situação antes de perguntar. Ex.: "Boa tarde, eu tinha marcado um horário pra ontem mas não consegui ir, será que dá pra remarcar sem problema?"

**Aplicação prática:** o classificador (Camada 1) já normaliza acentuação e caixa antes de comparar (`normalizarUniversal`), o que cobre boa parte da seção 3.2 automaticamente. As abreviações da seção 3.1 **não** são expandidas automaticamente hoje — é uma lacuna real identificada aqui, não implementada nesta fase (ver seção 6 do documento de arquitetura, Fase A/B).

---

## 4. Respostas base (neutras, profissionais, reutilizáveis — nenhuma menção a segmento)

| Intenção | Resposta base |
|---|---|
| Saudação | "Olá! 👋 Como posso te ajudar hoje?" |
| Despedida | "Foi um prazer falar com você! Qualquer coisa, estou por aqui." |
| Agendamento | "Para agendar, me diga o melhor dia e horário — nossa equipe confirma com você." |
| Reagendamento | "Sem problemas! Me diga para quando gostaria de remarcar que já encaminho para a equipe." |
| Cancelamento | "Entendido. Vou registrar o cancelamento e a equipe confirma com você em breve." |
| Horário | "Nosso horário de atendimento é: [dado da empresa]." |
| Endereço | "Estamos localizados em: [dado da empresa]." |
| Telefone | "Nosso telefone de contato é: [dado da empresa]." |
| WhatsApp | "Sim, este é o nosso canal oficial de atendimento." |
| Serviços | "Trabalhamos com: [dado da empresa]. Quer que eu detalhe algum deles?" |
| Orçamento | "Para te passar um orçamento certinho, preciso confirmar alguns detalhes com a equipe — pode me contar um pouco mais do que você precisa?" |
| Formas de contato | "Você pode falar com a gente por aqui mesmo. [Se houver outros canais cadastrados, listar]." |
| Dúvidas gerais | "Claro, pode perguntar! Vou fazer o possível para te ajudar." |
| Reclamações | "Sinto muito pelo ocorrido. Vou encaminhar sua mensagem para a equipe para que possam te ajudar da melhor forma." |
| Elogios | "Muito obrigado pelo retorno! Isso é muito importante para a gente. 😊" |
| Falar com atendente | "Claro! Já vou te encaminhar para nossa equipe." |

**Nenhuma resposta acima cita nome de segmento** (não fala "clínica", "oficina", "barbearia" em nenhuma delas) — o que muda por empresa é só o dado entre colchetes, nunca o texto da resposta em si.

---

## 5. Regras negativas — quando a IA NÃO deve responder como se soubesse

| Situação | O que a IA faz | Resposta modelo |
|---|---|---|
| Preço não cadastrado | Nunca estima, nunca inventa valor | "No momento não tenho um valor fixo para te passar por aqui, mas nossa equipe confirma certinho pra você." |
| Horário ausente (empresa não cadastrou) | Nunca supõe um horário comercial padrão | "Não tenho o horário confirmado aqui comigo — posso te colocar em contato com a equipe para confirmar certinho?" |
| Serviço inexistente / não cadastrado | Nunca confirma nem nega um serviço que não está na lista da empresa | "Não tenho essa informação confirmada sobre esse serviço específico — posso confirmar com a equipe e te retorno." |
| Endereço não informado | Nunca inventa uma localização aproximada | "Ainda não tenho o endereço confirmado aqui — posso te conectar com a equipe para te passar certinho." |

**Princípio único por trás das quatro linhas:** a resposta "eu não sei, mas posso confirmar" é sempre preferível a qualquer suposição, mesmo uma suposição razoável. Isso já é a mesma regra aplicada em `montarRespostaUniversal` (Fase 1) — quando falta o dado, a função devolve `null`, nunca um texto de preenchimento.

---

## 6. Cenários de transferência para atendimento humano

| # | Gatilho | Por quê transferir |
|---|---|---|
| 1 | Cliente pede explicitamente ("falar com atendente", "quero humano") | Pedido direto sempre tem prioridade — nunca insistir em resolver sozinho |
| 2 | IA não entende a mesma intenção 2 vezes seguidas | Evita loop frustrante — já é regra definida na Fase 1 (seção 3.3 da arquitetura) |
| 3 | Reclamação (qualquer uma da seção 2.14) | Insatisfação exige resposta humana, empática e com poder de resolução — a IA só acolhe e encaminha, nunca tenta "resolver" uma reclamação sozinha |
| 4 | Pedido de orçamento com detalhes específicos/customizados | A IA pode confirmar que recebeu, mas não fecha valores sem revisão humana |
| 5 | Qualquer uma das 4 regras negativas da seção 5 acontece **duas vezes na mesma conversa** | Se a empresa não cadastrou o dado e o cliente insiste, converter em atendimento humano em vez de repetir "não sei" |
| 6 | Mensagem ambígua mesmo após um pedido de esclarecimento | Depois de UMA tentativa de esclarecer, se ainda não for possível classificar, transferir |
| 7 | Assunto sensível ou fora do escopo de atendimento (jurídico específico, diagnóstico médico, disputa contratual) | A IA nunca deve emitir parecer técnico/profissional — só orienta gestão do contato, nunca substitui o profissional |
| 8 | Cliente demonstra urgência explícita ("urgente", "emergência") combinada com uma intenção que a IA não resolve sozinha (ex.: cancelamento de última hora) | Reduz risco de um caso urgente ficar só com uma resposta genérica |

---

## 7. O que esta entrega NÃO inclui (por escopo, não por esquecimento)

- Nenhuma mudança em `lib/ia-universal/` ou em `app/api/chatbot/message/route.ts` — este documento é conteúdo, não código.
- Nenhuma expansão automática de abreviação implementada (seção 3.1 é catálogo de referência, não normalização ativa).
- Nenhuma decisão sobre separar `reagendar_cancelar` e `elogio_reclamacao` em intenções distintas no código — sinalizado na seção 1, decisão em aberto.
- Nenhum treinamento foi ativado em `chatbot_treinamento` para nenhum tenant real.

**Próximo passo:** aguardando sua validação deste conteúdo antes de qualquer wiring com o código (isso seria uma Fase 3 separada, com autorização própria).
