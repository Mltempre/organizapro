import { ARTICLES_PART2 } from "./articles-part2";
import { ARTICLES_PART3 } from "./articles-part3";
export type { Category, ContentBlock, Article } from "./types";
import type { Article, Category } from "./types";

export const BASE_URL = "https://clinicafllow.com.br";
export const WPP_NUMBER = "5541988379119";
export const WPP_MESSAGE_BLOG = encodeURIComponent(
  "Olá, li um artigo no blog da ClínicaFlow e quero agendar uma demonstração para minha clínica."
);

const ARTICLES_BASE: Article[] = [
  {
    slug: "como-reduzir-faltas-de-pacientes-usando-whatsapp",
    title: "Como Reduzir Faltas de Pacientes Usando WhatsApp: Guia Completo para Clínicas",
    description:
      "Descubra como usar o WhatsApp para reduzir faltas de pacientes na sua clínica em até 70%. Estratégias práticas de lembretes automáticos e confirmações que funcionam de verdade.",
    category: "WhatsApp para Clínicas",
    author: "Equipe ClínicaFlow",
    authorRole: "Especialistas em Gestão de Clínicas",
    publishedAt: "2026-06-10",
    readingTime: 7,
    coverEmoji: "📲",
    excerpt:
      "Faltas de pacientes custam caro. A boa notícia: uma estratégia simples de lembretes pelo WhatsApp pode reduzir no-shows em até 70% sem contratar ninguém.",
    keywords: [
      "reduzir faltas pacientes",
      "lembrete consulta whatsapp",
      "confirmação de consulta automática",
      "no-show clínica",
      "whatsapp para clínicas",
      "reduzir no-show consultório",
    ],
    content: [
      {
        type: "p",
        text: "Se você tem uma clínica ou consultório, sabe bem o quanto uma falta de paciente dói. Não é só o horário vazio — é a perda de receita, o custo operacional que não para, e a impossibilidade de encaixar outro paciente com tão pouco tempo de aviso. O problema é mais sério do que parece.",
      },
      {
        type: "h2",
        text: "O Impacto Real das Faltas na Sua Clínica",
      },
      {
        type: "p",
        text: "Estudos do setor de saúde no Brasil mostram que a taxa média de no-show em clínicas médicas e odontológicas varia entre 15% e 30%. Isso significa que, em uma agenda com 20 consultas por dia, até 6 pacientes simplesmente não aparecem.",
      },
      {
        type: "stat",
        value: "R$ 3.200",
        label: "Perda média mensal por faltas em uma clínica com 20 consultas/dia",
      },
      {
        type: "p",
        text: "Multiplique isso por doze meses e você terá uma cifra que assusta: mais de R$ 38 mil por ano em receita perdida para faltas evitáveis. A palavra-chave aqui é evitáveis — porque a maioria das faltas não acontece por má vontade do paciente. Acontece por esquecimento.",
      },
      {
        type: "highlight",
        text: "\"Em três semanas usando lembretes automáticos, minhas faltas caíram de 22% para menos de 5%. Foi a mudança de maior impacto que fiz na clínica em anos.\"",
        author: "Dr. Rafael Costa",
        role: "Dentista, São Paulo – SP",
      },
      {
        type: "h2",
        text: "Por Que os Pacientes Faltam às Consultas?",
      },
      {
        type: "p",
        text: "Antes de resolver o problema, precisamos entender a causa. A grande maioria das faltas tem uma origem simples e completamente prevenível:",
      },
      {
        type: "h3",
        text: "Esquecimento Puro",
      },
      {
        type: "p",
        text: "Segundo pesquisas da área da saúde, mais de 60% das faltas acontecem porque o paciente simplesmente esqueceu. A consulta foi marcada dias ou semanas antes, a vida aconteceu no meio do caminho, e o compromisso saiu da memória. Não é má vontade — é a realidade da vida moderna.",
      },
      {
        type: "h3",
        text: "Falta de Lembretes Eficientes",
      },
      {
        type: "p",
        text: "Muitas clínicas ainda dependem de ligações telefônicas manuais para confirmar consultas. Além de consumir tempo valioso da equipe, as ligações têm baixa taxa de atendimento — menos de 40% dos pacientes atendem chamadas de números desconhecidos. O resultado: o lembrete não chega, a falta acontece.",
      },
      {
        type: "h3",
        text: "Dificuldade de Cancelar com Antecedência",
      },
      {
        type: "p",
        text: "Quando o paciente percebe que não poderá comparecer, muitas vezes não sabe como avisar. Ligar para a clínica parece trabalhoso, e o resultado é o silêncio — a falta sem aviso que deixa o horário inutilizável para qualquer reposição.",
      },
      {
        type: "h2",
        text: "Por Que o WhatsApp é a Melhor Ferramenta para Reduzir Faltas",
      },
      {
        type: "p",
        text: "O WhatsApp não é apenas o aplicativo mais usado no Brasil — ele é o canal de comunicação com maior taxa de leitura do mundo. Enquanto e-mails têm taxa de abertura de 20% e ligações são ignoradas na maioria das vezes, mensagens de WhatsApp são lidas em média em menos de 5 minutos.",
      },
      {
        type: "ul",
        items: [
          "98% das mensagens de WhatsApp são abertas — contra 20% de e-mails",
          "90% dos brasileiros usam WhatsApp todos os dias",
          "Mensagens de texto têm 5x mais respostas que ligações telefônicas",
          "O custo de envio é praticamente zero comparado a ligações manuais",
          "O paciente pode confirmar ou cancelar com apenas uma mensagem",
        ],
      },
      {
        type: "p",
        text: "Combinar a capilaridade do WhatsApp com automação inteligente cria um sistema que trabalha por você 24 horas por dia, 7 dias por semana — sem custo de funcionário adicional.",
      },
      {
        type: "h2",
        text: "Como Funciona um Sistema de Lembretes Automáticos pelo WhatsApp",
      },
      {
        type: "p",
        text: "Um sistema eficiente de confirmação via WhatsApp funciona em camadas. Cada lembrete tem um objetivo específico e é enviado no momento certo para maximizar a taxa de confirmação:",
      },
      {
        type: "h3",
        text: "1. Lembrete 48 Horas Antes",
      },
      {
        type: "p",
        text: "O primeiro lembrete é enviado dois dias antes da consulta. Ele serve para reativar a memória do paciente com antecedência suficiente para reorganizar a agenda caso haja conflito. A mensagem deve ser amigável, clara e incluir todas as informações relevantes: data, horário, endereço e nome do profissional.",
      },
      {
        type: "tip",
        label: "Modelo de mensagem 48h",
        text: "Olá, [Nome]! 😊 Lembrando que sua consulta com [Dr. Nome] está agendada para amanhã, [data], às [horário]. Confirme com SIM ou avise se precisar remarcar. — ClínicaFlow",
      },
      {
        type: "h3",
        text: "2. Lembrete 2 Horas Antes",
      },
      {
        type: "p",
        text: "O segundo lembrete, enviado 2 horas antes da consulta, funciona como uma chamada de ação final. Neste momento, o paciente já está no seu dia de trabalho e o lembrete chega no horário certo para que ele se organize para ir à clínica. Este lembrete sozinho pode reduzir faltas de última hora em até 40%.",
      },
      {
        type: "h3",
        text: "3. Confirmação Automática e Encaixe de Cancelamentos",
      },
      {
        type: "p",
        text: "Quando o sistema detecta que um paciente não confirmou ou enviou um cancelamento, ele pode automaticamente notificar a equipe para acionar a lista de espera — aproveitando o horário que seria perdido. Este recurso transforma uma falta em oportunidade de atendimento.",
      },
      {
        type: "h2",
        text: "Resultados Reais: O Que Clínicas Estão Conseguindo",
      },
      {
        type: "p",
        text: "Clínicas que implementam lembretes automáticos pelo WhatsApp relatam resultados consistentes já nas primeiras semanas de uso:",
      },
      {
        type: "ul",
        items: [
          "Redução de 60% a 70% nas faltas sem aviso (no-shows)",
          "Economia de 3 a 5 horas semanais da equipe em ligações de confirmação",
          "Aumento de 20% a 30% na ocupação da agenda com encaixe de lista de espera",
          "Melhora na satisfação do paciente com comunicação mais fluida",
          "ROI positivo já no primeiro mês de uso",
        ],
      },
      {
        type: "highlight",
        text: "\"Antes perdíamos em média R$4.800 por mês em faltas. Depois de automatizar os lembretes via WhatsApp, esse número caiu para menos de R$800. O sistema se pagou em 5 dias.\"",
        author: "Dra. Camila Ferreira",
        role: "Clínica de Estética, Curitiba – PR",
      },
      {
        type: "h2",
        text: "Passo a Passo Para Implementar na Sua Clínica",
      },
      {
        type: "ol",
        items: [
          "Mapeie sua taxa atual de faltas: quantas por semana e qual o valor médio perdido",
          "Defina os momentos de envio dos lembretes (recomendado: 48h e 2h antes)",
          "Crie templates de mensagens personalizados para cada especialidade",
          "Configure as respostas automáticas para confirmação e cancelamento",
          "Integre com sua agenda para acionar automaticamente a lista de espera",
          "Monitore os resultados semanalmente e ajuste os templates conforme necessário",
        ],
      },
      {
        type: "h2",
        text: "Automação vs. Processo Manual: A Conta Não Fecha",
      },
      {
        type: "p",
        text: "Muitas clínicas tentam fazer esse processo manualmente — uma funcionária responsável por ligar ou mandar mensagem para cada paciente. O problema é que esse processo não escala. Com 30, 40 ou 50 pacientes por dia, o trabalho se torna inviável, as mensagens atrasam, e o resultado é inconsistente.",
      },
      {
        type: "p",
        text: "Um sistema automatizado envia os lembretes no horário exato, todos os dias, para todos os pacientes — sem falhar, sem esquecer, sem custo adicional de mão de obra. É a diferença entre um processo que depende de uma pessoa e um processo que funciona sozinho.",
      },
      {
        type: "tip",
        label: "Dica importante",
        text: "O segredo não é apenas lembrar o paciente — é facilitar para ele confirmar ou cancelar. Quanto mais simples for a resposta, maior será a taxa de retorno.",
      },
      {
        type: "h2",
        text: "Conclusão: Cada Falta Evitada É Lucro Direto",
      },
      {
        type: "p",
        text: "Reduzir faltas de pacientes não é só uma questão de organização — é estratégia financeira. Cada consulta que acontece no horário marcado é receita garantida. Cada falta evitada é um custo que não se materializa. E a ferramenta mais eficiente para isso hoje, no Brasil, é o WhatsApp com automação inteligente.",
      },
      {
        type: "p",
        text: "O ClínicaFlow faz exatamente isso: envia lembretes automáticos personalizados pelo WhatsApp, processa confirmações e cancelamentos em tempo real, e notifica sua equipe para aproveitar cada horário liberado. Tudo sem nenhuma ação manual da sua equipe.",
      },
      { type: "cta" },
    ],
  },

  {
    slug: "como-confirmar-consultas-automaticamente-pelo-whatsapp",
    title: "Como Confirmar Consultas Automaticamente pelo WhatsApp em 2026",
    description:
      "Aprenda a automatizar a confirmação de consultas pelo WhatsApp na sua clínica. Economize horas da sua equipe, reduza no-shows e melhore a experiência do paciente com automação inteligente.",
    category: "WhatsApp para Clínicas",
    author: "Equipe ClínicaFlow",
    authorRole: "Especialistas em Gestão de Clínicas",
    publishedAt: "2026-06-12",
    readingTime: 6,
    coverEmoji: "✅",
    excerpt:
      "Automatizar confirmações de consulta via WhatsApp é a mudança que mais economiza tempo em clínicas — até 5 horas por semana sem contratar ninguém a mais.",
    keywords: [
      "confirmar consulta automaticamente",
      "confirmação de consulta whatsapp",
      "automatizar agenda clínica",
      "sistema de confirmação de consultas",
      "whatsapp automático clínica",
      "lembrete automático paciente",
    ],
    content: [
      {
        type: "p",
        text: "Quantas horas por semana sua equipe passa ligando para pacientes para confirmar consultas? Se a resposta for 'muitas', você não está sozinho. Ligar, aguardar atendimento, deixar recado, aguardar retorno, ligar de novo — é um ciclo que consome tempo precioso que poderia ser usado para atender mais pacientes ou melhorar outros processos da clínica.",
      },
      {
        type: "h2",
        text: "O Problema com a Confirmação Manual de Consultas",
      },
      {
        type: "p",
        text: "O processo tradicional de confirmação de consultas é ineficiente por natureza. Uma funcionária passa horas ao telefone, com baixa taxa de sucesso — a maioria dos pacientes não atende ligações de números desconhecidos. O que sobra é incerteza: a clínica não sabe quem vai aparecer, e o paciente recebe um processo de confirmação que parece desatualizado para os padrões de comunicação de 2026.",
      },
      {
        type: "ul",
        items: [
          "Menos de 40% dos pacientes atendem ligações de números desconhecidos",
          "Confirmação manual consome 3 a 5 horas semanais da equipe em clínicas médias",
          "Processos manuais não escalam — quanto maior a agenda, maior o caos",
          "A falta de padronização cria erros: paciente confirmado errado, horário trocado",
          "Funcionário humano não confirma nos fins de semana ou fora do horário comercial",
        ],
      },
      {
        type: "h2",
        text: "Por Que a Confirmação via WhatsApp Mudou o Jogo",
      },
      {
        type: "p",
        text: "O WhatsApp resolve todos esses problemas de uma vez. Com uma taxa de abertura de 98% e resposta média de menos de 5 minutos, uma mensagem bem escrita no WhatsApp alcança o paciente de forma muito mais eficiente do que qualquer ligação telefônica. E quando essa mensagem é enviada automaticamente, no horário certo, sem depender de nenhuma ação humana, o resultado é transformador.",
      },
      {
        type: "stat",
        value: "98%",
        label: "das mensagens de WhatsApp são abertas — contra 20% de e-mails e 40% de chamadas atendidas",
      },
      {
        type: "highlight",
        text: "\"Nossa recepcionista passava a manhã toda ligando para confirmar consultas. Hoje ela só recebe o relatório de quem confirmou e quem cancelou. Sobrou tempo para ela focar no atendimento presencial.\"",
        author: "Dr. Thiago Mello",
        role: "Ortopedista, Belo Horizonte – MG",
      },
      {
        type: "h2",
        text: "Como Funciona a Confirmação Automática de Consultas",
      },
      {
        type: "p",
        text: "Um sistema de confirmação automática pelo WhatsApp funciona de forma integrada com a agenda da clínica. Veja o fluxo completo:",
      },
      {
        type: "h3",
        text: "Etapa 1: Agendamento e Cadastro Automático",
      },
      {
        type: "p",
        text: "Quando uma consulta é agendada — seja pelo sistema interno, pelo site ou presencialmente — o número de WhatsApp do paciente é registrado e o sistema já programa automaticamente os lembretes futuros. Nenhuma ação manual é necessária.",
      },
      {
        type: "h3",
        text: "Etapa 2: Envio do Lembrete no Horário Certo",
      },
      {
        type: "p",
        text: "O sistema envia a mensagem de confirmação no horário programado — geralmente 48 horas antes e novamente 2 horas antes da consulta. A mensagem é personalizada com nome do paciente, data, horário e nome do profissional, transmitindo profissionalismo e atenção.",
      },
      {
        type: "tip",
        label: "Boas práticas para a mensagem de confirmação",
        text: "Use o nome do paciente, inclua data e horário exatos, apresente opções simples (confirmar com SIM ou pedir remarcação), e mantenha tom amigável mas profissional. Mensagens muito longas têm menor taxa de resposta.",
      },
      {
        type: "h3",
        text: "Etapa 3: Processamento da Resposta",
      },
      {
        type: "p",
        text: "Quando o paciente responde — seja confirmando, cancelando ou pedindo para remarcar — o sistema processa a resposta automaticamente. Uma confirmação atualiza o status na agenda. Um cancelamento libera o horário e pode acionar uma notificação para a equipe encaixar outro paciente da lista de espera.",
      },
      {
        type: "h3",
        text: "Etapa 4: Relatório em Tempo Real para a Equipe",
      },
      {
        type: "p",
        text: "A equipe da clínica acompanha em tempo real quais pacientes confirmaram, quais cancelaram e quais ainda não responderam. Com essa visibilidade, é possível tomar ações proativas — como ligar apenas para os pacientes que não responderam ao WhatsApp, reduzindo drasticamente o esforço manual.",
      },
      {
        type: "h2",
        text: "O Que Fazer com os Pacientes que Não Confirmam?",
      },
      {
        type: "p",
        text: "Uma parte dos pacientes simplesmente não responde ao lembrete. Para esses casos, há uma estratégia eficiente: um segundo lembrete automatizado mais próximo do horário da consulta, com linguagem mais direta. Se ainda assim não houver resposta, o sistema notifica a equipe para uma ação manual pontual — mas agora com apenas uma fração dos casos, tornando o trabalho muito mais gerenciável.",
      },
      {
        type: "h2",
        text: "Automação de Confirmação e a Lista de Espera",
      },
      {
        type: "p",
        text: "Uma das maiores vantagens da confirmação automatizada é a integração com a lista de espera. Quando um paciente cancela com antecedência suficiente, o sistema pode imediatamente avisar pacientes em espera sobre a disponibilidade do horário. Isso transforma cancelamentos — que antes eram perdas certas — em oportunidades de encaixe.",
      },
      {
        type: "ul",
        items: [
          "Cancelamento automático libera o horário na agenda instantaneamente",
          "Notificação para lista de espera pode ser enviada em segundos",
          "Paciente em espera que confirmar rápido ocupa o horário sem intervenção manual",
          "Clínica mantém a agenda sempre cheia, mesmo com cancelamentos",
        ],
      },
      {
        type: "h2",
        text: "Quanto Tempo Sua Equipe Vai Economizar?",
      },
      {
        type: "p",
        text: "Em uma clínica com 20 consultas por dia e 5 dias de funcionamento semanal (100 consultas/semana), o processo manual de confirmação exige em média 3 a 5 horas de trabalho da equipe. Com automação total via WhatsApp, esse tempo cai para menos de 30 minutos — apenas para acompanhar o relatório e tomar ações pontuais nos casos de não resposta.",
      },
      {
        type: "stat",
        value: "4h/semana",
        label: "Economia média de tempo da equipe com confirmações automatizadas",
      },
      {
        type: "h2",
        text: "Como Escolher o Sistema Certo de Confirmação Automática",
      },
      {
        type: "p",
        text: "Nem toda ferramenta de automação de WhatsApp é adequada para clínicas de saúde. Ao avaliar opções, considere:",
      },
      {
        type: "ol",
        items: [
          "Integração com sua agenda: o sistema precisa conhecer os agendamentos para disparar os lembretes automaticamente",
          "Personalização de mensagens: cada especialidade tem uma linguagem própria — o sistema deve permitir customização",
          "Processamento de respostas: não basta enviar, o sistema precisa entender e processar as respostas dos pacientes",
          "Relatórios claros: visibilidade em tempo real de quem confirmou e quem não respondeu",
          "Suporte e implantação: ferramentas complexas sem suporte viram mais um problema do que solução",
        ],
      },
      {
        type: "h2",
        text: "Confirmação Automática É Só o Começo",
      },
      {
        type: "p",
        text: "A confirmação automática de consultas é o primeiro passo de uma estratégia completa de comunicação com pacientes. O mesmo sistema que confirma consultas pode, após o atendimento, pedir avaliações no Google, enviar lembretes de retorno, reativar pacientes inativos e muito mais — tudo automaticamente, sem custo de equipe adicional.",
      },
      {
        type: "p",
        text: "O ClínicaFlow integra todas essas funções em um único painel. Da confirmação da consulta à avaliação pós-atendimento, o sistema cuida de toda a comunicação com seus pacientes de forma automática, personalizada e profissional.",
      },
      { type: "cta" },
    ],
  },

  {
    slug: "como-conseguir-mais-avaliacoes-no-google-para-sua-clinica",
    title: "Como Conseguir Mais Avaliações no Google para Sua Clínica em 2026",
    description:
      "Guia prático para clínicas e consultórios aumentarem avaliações no Google de forma ética e automatizada. Estratégias que funcionam para dentistas, dermatologistas, estetas e mais.",
    category: "Google Avaliações",
    author: "Equipe ClínicaFlow",
    authorRole: "Especialistas em Gestão de Clínicas",
    publishedAt: "2026-06-15",
    readingTime: 7,
    coverEmoji: "⭐",
    excerpt:
      "Avaliações no Google são o novo boca a boca. Clínicas com mais de 4.5 estrelas atraem até 3x mais pacientes novos — e você pode automatizar todo esse processo.",
    keywords: [
      "avaliações google clínica",
      "como conseguir avaliações google",
      "aumentar avaliações google consultório",
      "google meu negócio clínica",
      "reputação online clínica médica",
      "mais avaliações google dentista",
    ],
    content: [
      {
        type: "p",
        text: "Quando alguém procura um dentista, dermatologista ou clínica de estética em sua cidade, a primeira coisa que vê é o Google. E no Google, o que decide quem vai ligar ou quem vai ser ignorado não é o site mais bonito nem o anúncio mais caro — são as avaliações. Clínicas com muitas avaliações positivas ganham não só visibilidade, mas credibilidade. E credibilidade converte.",
      },
      {
        type: "h2",
        text: "Por Que as Avaliações no Google São o Ativo Mais Valioso da Sua Clínica",
      },
      {
        type: "p",
        text: "Uma clínica com 4.8 estrelas e 200 avaliações compete de igual para igual com clínicas muito maiores e melhor localizadas. Para o paciente que está pesquisando no Google, as estrelas e os depoimentos são evidências sociais — a prova de que outras pessoas confiaram, foram tratadas bem e estão satisfeitas.",
      },
      {
        type: "ul",
        items: [
          "88% dos consumidores confiam em avaliações online tanto quanto em indicações de amigos",
          "Clínicas com mais de 4.5 estrelas recebem até 3x mais cliques no Google",
          "70% dos pacientes leem avaliações antes de agendar consulta com profissional de saúde",
          "Negócios com mais de 100 avaliações aparecem com mais frequência em buscas locais",
          "Uma queda de 0.5 estrela pode reduzir em 30% o volume de novos contatos",
        ],
      },
      {
        type: "stat",
        value: "3x",
        label: "Mais cliques recebem clínicas com avaliação acima de 4.5 estrelas no Google",
      },
      {
        type: "h2",
        text: "O Problema: Pedir Avaliação É Desconfortável",
      },
      {
        type: "p",
        text: "Todo profissional de saúde sabe que deveria pedir mais avaliações. O problema é que pedir pessoalmente na consulta é constrangedor — parece um pedido de favor, e muitos profissionais simplesmente não fazem. A equipe, por sua vez, esquece ou não se sente à vontade para abordar o tema no final do atendimento.",
      },
      {
        type: "p",
        text: "O resultado? A clínica tem dezenas de pacientes satisfeitos que sairiam cheios de vontade de avaliar, mas ninguém nunca pediu. Essas avaliações ficam na cabeça do paciente e nunca chegam ao Google.",
      },
      {
        type: "highlight",
        text: "\"Fui de 4.1 para 4.8 estrelas em 6 semanas. Não mudei nada na qualidade do atendimento — só automatizei o pedido de avaliação após cada consulta.\"",
        author: "Fernanda Lima",
        role: "Clínica de Estética, Curitiba – PR",
      },
      {
        type: "h2",
        text: "O Segredo: Pedir no Momento Certo, pelo Canal Certo",
      },
      {
        type: "p",
        text: "A chave para conseguir avaliações não é quantidade de pedidos — é o momento e o canal. Um paciente que acabou de ter uma boa experiência na sua clínica está no pico da satisfação. Se você pedir a avaliação exatamente nesse momento, a conversão é muito maior do que se pedir dias depois, quando o entusiasmo já esfriou.",
      },
      {
        type: "h3",
        text: "O Momento Ideal: Logo Após o Atendimento",
      },
      {
        type: "p",
        text: "O melhor momento para pedir uma avaliação é nas primeiras 2 a 4 horas após o atendimento. O paciente acabou de sair da clínica, a experiência está fresca na memória, e ele está no ápice da satisfação. Uma mensagem gentil e personalizada nesse momento tem taxa de conversão de 30% a 50% — muito acima de qualquer outro momento.",
      },
      {
        type: "h3",
        text: "O Canal Ideal: WhatsApp",
      },
      {
        type: "p",
        text: "E-mails pedem avaliação são quase sempre ignorados. Ligações telefônicas são invasivas. Mas uma mensagem de WhatsApp chegando no horário certo, com o nome do paciente e um link direto para a avaliação no Google? Funciona. A taxa de abertura do WhatsApp garante que a mensagem será vista, e um link direto elimina toda a fricção do processo.",
      },
      {
        type: "tip",
        label: "Modelo de mensagem pós-atendimento",
        text: "Olá, [Nome]! Esperamos que sua consulta tenha sido ótima. 😊 Sua opinião é muito importante para nós e para outros pacientes que buscam atendimento de qualidade. Poderia avaliar nossa clínica no Google? Leva menos de 1 minuto: [link direto para avaliação]. Muito obrigado!",
      },
      {
        type: "h2",
        text: "Como Automatizar o Pedido de Avaliações",
      },
      {
        type: "p",
        text: "Fazer isso manualmente para cada paciente é inviável. Com 10, 20 ou 30 atendimentos por dia, não há tempo humano suficiente para enviar pedidos personalizados logo após cada consulta. A solução é automação:",
      },
      {
        type: "ol",
        items: [
          "Integre sua agenda com um sistema de automação de WhatsApp",
          "Configure o disparo automático após a marcação de consulta como 'concluída'",
          "Personalize a mensagem com nome do paciente e link direto para o Google",
          "Defina o horário de envio: imediatamente após ou com delay de 1-2 horas",
          "Monitore os resultados e ajuste a mensagem conforme necessário",
        ],
      },
      {
        type: "p",
        text: "Com um sistema automatizado, cada paciente atendido recebe automaticamente o pedido de avaliação no momento certo — sem depender de memória humana, sem ser esquecido, sem constrangimento.",
      },
      {
        type: "h2",
        text: "Como Responder Às Avaliações (Positivas e Negativas)",
      },
      {
        type: "p",
        text: "Tão importante quanto conseguir avaliações é responder a elas. O Google valoriza negócios que interagem com seus clientes, e potenciais pacientes leem não só as avaliações, mas também as respostas da clínica — especialmente nas avaliações negativas.",
      },
      {
        type: "h3",
        text: "Respondendo Avaliações Positivas",
      },
      {
        type: "p",
        text: "Para avaliações positivas, seja genuíno e específico. Agradeça pelo feedback, mencione algo da avaliação que mostre que você realmente leu, e convide o paciente a retornar. Evite respostas genéricas copiadas e coladas — elas soam automatizadas e diminuem a credibilidade.",
      },
      {
        type: "h3",
        text: "Respondendo Avaliações Negativas",
      },
      {
        type: "p",
        text: "Avaliações negativas são inevitáveis — e como você responde a elas pode ser mais importante do que a avaliação em si. Nunca responda na defensiva. Reconheça a experiência do paciente, peça desculpas pelo inconveniente e ofereça um canal privado para resolver a situação. Uma resposta profissional e empática a uma avaliação negativa frequentemente convence novos pacientes de que a clínica é confiável e comprometida com a qualidade.",
      },
      {
        type: "tip",
        label: "Regra de ouro para avaliações negativas",
        text: "Responda em até 24 horas. Uma resposta rápida demonstra que a clínica monitora e se importa com o feedback. Demora demais e você perde a oportunidade de controlar a narrativa.",
      },
      {
        type: "h2",
        text: "Estratégia Completa Para Escalar Avaliações",
      },
      {
        type: "p",
        text: "Para clínicas que querem ir além e construir uma presença sólida no Google, aqui está a estratégia completa:",
      },
      {
        type: "ol",
        items: [
          "Optimize seu perfil no Google Meu Negócio: fotos profissionais, horários corretos, descrição completa com palavras-chave relevantes",
          "Configure automação de pedidos pós-atendimento via WhatsApp",
          "Responda a todas as avaliações em menos de 24 horas",
          "Treine a equipe para mencionar o WhatsApp de avaliação na despedida do paciente como reforço",
          "Monitore as avaliações semanalmente e use o feedback para melhorar processos",
          "Quando atingir 50+ avaliações, revise a estratégia e estabeleça nova meta",
        ],
      },
      {
        type: "h2",
        text: "Quantas Avaliações Uma Clínica Precisa?",
      },
      {
        type: "p",
        text: "Não existe número mágico, mas existem marcos importantes. Com 10 avaliações, sua clínica já aparece de forma mais destacada nas buscas locais. Com 50 avaliações, você constrói credibilidade suficiente para superar a objeção de pacientes novos. Com 100+ avaliações, sua clínica se torna referência e pode disputar posições de destaque até com concorrentes maiores.",
      },
      {
        type: "stat",
        value: "100+",
        label: "Avaliações é o marco que transforma sua clínica em referência local no Google",
      },
      {
        type: "h2",
        text: "Conclusão: Avaliações São Receita Previsível",
      },
      {
        type: "p",
        text: "Cada avaliação positiva no Google é uma vitrine permanente para novos pacientes. É conteúdo gerado por quem já confiou em você — a forma mais poderosa de marketing para serviços de saúde. E diferentemente de anúncios pagos, avaliações continuam trabalhando por você indefinidamente, sem custo adicional.",
      },
      {
        type: "p",
        text: "O ClínicaFlow automatiza todo esse processo: envia o pedido de avaliação pelo WhatsApp no momento certo após cada atendimento, monitora as avaliações recebidas e ajuda sua clínica a construir uma reputação online sólida e crescente — sem nenhum trabalho manual da sua equipe.",
      },
      { type: "cta" },
    ],
  },
];

export const ARTICLES: Article[] = [
  ...ARTICLES_BASE,
  ...ARTICLES_PART2,
  ...ARTICLES_PART3,
];

export function getArticleBySlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function getRelatedArticles(slug: string, limit = 2): Article[] {
  return ARTICLES.filter((a) => a.slug !== slug).slice(0, limit);
}

export const CATEGORY_COLORS: Record<Category, { bg: string; text: string }> = {
  "WhatsApp para Clínicas": { bg: "#052e16", text: "#4ade80" },
  "Google Avaliações": { bg: "#1c1917", text: "#fbbf24" },
  "Marketing para Clínicas": { bg: "#1e1b4b", text: "#a78bfa" },
  "Gestão de Clínicas": { bg: "#0c1a2e", text: "#38bdf8" },
  "Inteligência Artificial": { bg: "#1a0533", text: "#e879f9" },
};

export const ALL_CATEGORIES: Category[] = [
  "Marketing para Clínicas",
  "WhatsApp para Clínicas",
  "Google Avaliações",
  "Gestão de Clínicas",
  "Inteligência Artificial",
];
