// ── IA Universal · Camada 2 (Módulos de Segmento) ───────────────────────────
//
// Ver docs/ia-universal-organizapro-v1-arquitetura.md, seção 4. Cada módulo
// só ACRESCENTA vocabulário/intenções específicas de um segmento — nunca
// substitui a Camada 1. Fase 1: conteúdo mínimo (o suficiente para provar que
// a seleção de módulo e o roteamento funcionam para os 13 segmentos pedidos),
// sem nenhuma consulta nova ao banco além da já usada por
// app/api/chatbot/message/route.ts.
//
// Seleção de módulo: `clinicas.especialidade` já existe como texto livre —
// nenhuma migração de banco nesta fase. Texto sem correspondência conhecida
// cai no módulo "generico" (Camada 2 vazia; só a Camada 1 responde) — nunca
// quebra, nunca inventa um segmento que a empresa não informou.

import { normalizarUniversal } from "./camada1-universal";
import type { DadosEmpresaUniversal, ModuloSegmento } from "./tipos";

// ─── Helper reutilizável por qualquer módulo (Fase 3) ──────────────────────
//
// Responde "sim"/"não" sobre um serviço específico só a partir do que a
// própria empresa já cadastrou em `clinica_servicos` (dados.servicos) — nunca
// inventa. `dados.servicos` undefined = ainda não carregado nesta chamada →
// devolve null (chamador cai no sistema atual); array vazio ou sem
// correspondência = carregado de verdade, resposta negativa é honesta, não é
// suposição.
function respostaDisponibilidadeServico(
  dados: DadosEmpresaUniversal,
  termosBusca: string[],
  frasePositiva: string,
  fraseNegativa: string,
): string | null {
  if (!dados.servicos) return null;
  const alvo = termosBusca.map(normalizarUniversal);
  const encontrado = dados.servicos.some(s => {
    const texto = normalizarUniversal(`${s.nome} ${s.descricao ?? ""}`);
    return alvo.some(t => texto.includes(t));
  });
  return encontrado ? frasePositiva : fraseNegativa;
}

// Para intenções que NUNCA devem ser respondidas com dado da empresa —
// diagnóstico técnico, orçamento fechado, prazo de entrega. Sempre a mesma
// resposta de encaminhamento, nenhuma tentativa de adivinhar. Reutilizável
// por qualquer segmento com o mesmo tipo de risco (ex.: Clínicas no futuro).
function respostaSempreEscalar(mensagem: string) {
  return (): string => mensagem;
}

// Para intenções de "listar o que a empresa tem" (cardápio, especialidades,
// produtos, planos, procedimentos, abordagens, áreas de atuação...) — mesmo
// formato em todos os segmentos que precisam disso, só muda o prefixo e a
// frase de quando não há nada cadastrado. Extraído durante a KENSA final
// (8 módulos reimplementavam a mesma lógica linha a linha).
function respostaListaServicos(
  dados: DadosEmpresaUniversal,
  prefixoComDados: string,
  fraseSemDados: string,
): string | null {
  if (!dados.servicos) return null;
  if (dados.servicos.length === 0) return fraseSemDados;
  const nomes = dados.servicos.map(s => s.nome).join(", ");
  return `${prefixoComDados}: ${nomes}. Posso te ajudar com mais alguma coisa?`;
}

const MODULO_GENERICO: ModuloSegmento = {
  chave: "generico",
  nomesAlternativos: [],
  vocabularioReconhecido: [],
  intencoesAdicionais: [],
};

const MODULOS: ModuloSegmento[] = [
  {
    // Fase 3 — segmento 5/13 (homologação própria, ver
    // docs/ia-universal-segmento-advogado-v1.md).
    chave: "advogados",
    nomesAlternativos: ["advocacia", "advogado", "advogados", "escritorio de advocacia"],
    vocabularioReconhecido: [
      "area de atuacao", "areas", "consulta inicial", "processo", "honorarios",
      "chance", "e crime", "posso processar", "meu caso", "advogado",
    ],
    intencoesAdicionais: [
      // ── Consulta dado real ──
      {
        id: "areas_atuacao",
        exemplosDeFrase: ["area de atuacao", "quais areas", "que tipo de caso", "quais casos voces atendem"],
        resolver: (dados) => respostaListaServicos(
          dados, "Atuamos em",
          "No momento não tenho as áreas de atuação confirmadas aqui, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "consulta_inicial",
        exemplosDeFrase: ["consulta inicial", "primeira consulta gratuita", "consulta gratis", "tem consulta gratuita"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["consulta inicial", "primeira consulta"],
          "Sim, oferecemos consulta inicial! Posso te ajudar a agendar.",
          "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      // ── Sempre escala — nunca dar parecer jurídico nem estimar prazo
      // processual, mesmo que pareça um caso simples (mesmo princípio já
      // registrado no documento de arquitetura: "não substitui decisão
      // humana... não dá parecer técnico").
      {
        id: "parecer_juridico",
        exemplosDeFrase: [
          "chance", "tenho razao", "e crime", "posso processar",
          "o que eu faco nessa situacao", "isso e ilegal",
        ],
        resolver: respostaSempreEscalar(
          "Não posso dar uma opinião jurídica por aqui — isso exige análise do seu caso específico. Posso te conectar com a equipe para uma avaliação correta?",
        ),
      },
      {
        id: "prazo_processual",
        exemplosDeFrase: ["prazo do processo", "quanto tempo demora um processo", "quanto tempo leva o processo", "prazo processual"],
        resolver: respostaSempreEscalar(
          "O prazo de um processo depende de vários fatores específicos do caso — posso te conectar com a equipe para confirmar?",
        ),
      },
    ],
  },
  {
    // Fase 3 — primeiro segmento com conteúdo real (homologação própria, ver
    // docs/ia-universal-segmento-barbearia-v1.md). Os demais 12 seguem como
    // stub da Fase 1 até receberem a mesma homologação, um de cada vez.
    chave: "barbearia",
    nomesAlternativos: ["barbearia", "barber", "barbeiro"],
    vocabularioReconhecido: [
      "corte", "barba", "cabelo", "degrade", "sobrancelha", "hidratacao",
      "penteado", "navalha", "pezinho", "corte infantil", "nevou", // "nevou" = gíria comum p/ degradê bem feito
    ],
    intencoesAdicionais: [
      {
        id: "corte_infantil",
        exemplosDeFrase: [
          "corte infantil", "corta cabelo de crianca", "atende crianca",
          "corte pra crianca", "cortam cabelo de nenem", "corte kids", "voces cortam infantil",
        ],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados,
          ["infantil", "crianca", "kids"],
          "Sim, fazemos corte infantil! Se quiser, posso te ajudar a agendar.",
          "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "barba",
        exemplosDeFrase: [
          "fazem barba", "faz a barba", "corte e barba", "barba tbm",
          "vcs fazem barba", "tem servico de barba", "barboterapia",
        ],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados,
          ["barba"],
          "Sim, trabalhamos com barba! Posso te ajudar a agendar.",
          "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "sobrancelha",
        exemplosDeFrase: [
          "fazem sobrancelha", "design de sobrancelha", "acerta a sobrancelha",
          "vcs fazem sobrancelha", "tem sobrancelha",
        ],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados,
          ["sobrancelha"],
          "Sim, fazemos sobrancelha! Posso te ajudar a agendar.",
          "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "hidratacao",
        exemplosDeFrase: [
          "fazem hidratacao", "tem hidratacao capilar", "hidrata o cabelo",
          "vcs hidratam", "tem hidratacao",
        ],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados,
          ["hidratacao"],
          "Sim, temos hidratação! Posso te ajudar a agendar.",
          "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
    ],
  },
  {
    // Fase 3 — segmento 2/13 (homologação própria, ver
    // docs/ia-universal-segmento-oficina-mecanica-v1.md).
    chave: "oficina",
    nomesAlternativos: ["oficina", "oficina mecanica", "mecanica", "auto center"],
    vocabularioReconhecido: [
      "alinhamento", "balanceamento", "revisao", "troca de oleo", "seguradora",
      "freio", "pastilha de freio", "suspensao", "bateria",
      "barulho", "diagnostico", "prazo", "fica pronto",
      "embreagem", "correia", "nao liga",
    ],
    intencoesAdicionais: [
      {
        id: "revisao",
        exemplosDeFrase: ["fazem revisao", "revisao completa", "revisao preventiva", "fazem revisao do carro", "tem revisao"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["revisao"],
          "Sim, fazemos revisão! Posso te ajudar a agendar.",
          "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "troca_oleo",
        exemplosDeFrase: ["troca de oleo", "troca oleo", "fazem troca de oleo", "preciso trocar o oleo", "trocam o oleo"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["oleo"],
          "Sim, fazemos troca de óleo! Posso te ajudar a agendar.",
          "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "freios",
        exemplosDeFrase: ["mexem com freio", "trocam pastilha de freio", "fazem freio", "revisao de freio", "cuidam do freio"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["freio"],
          "Sim, trabalhamos com freios! Posso te ajudar a agendar.",
          "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "alinhamento_balanceamento",
        exemplosDeFrase: ["fazem alinhamento", "fazem balanceamento", "alinhamento e balanceamento", "alinham o carro"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["alinhamento", "balanceamento"],
          "Sim, fazemos alinhamento e balanceamento! Posso te ajudar a agendar.",
          "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "atende_seguradora",
        exemplosDeFrase: ["seguradora", "atende seguradora", "trabalha com seguro", "trabalham com seguro", "aceita seguradora", "atende pelo seguro"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["seguradora", "seguro"],
          "Sim, atendemos por seguradora! Posso te ajudar a confirmar os detalhes com a equipe.",
          "No momento não tenho essa informação confirmada, mas posso verificar com a equipe para você.",
        ),
      },
      // ── Regras negativas específicas da oficina: nunca diagnosticar, nunca
      // prometer prazo — mesmo que o cliente pergunte diretamente e mesmo que
      // pareça um caso simples. Sempre escala, nunca consulta `servicos`.
      {
        id: "diagnostico_sem_avaliacao",
        exemplosDeFrase: [
          "barulho", "embreagem", "correia", "nao liga",
          "meu carro esta fazendo um barulho", "o que pode ser", "por que meu carro nao liga",
          "esta com um problema estranho", "acho que e o motor", "pode ser a embreagem",
          "meu carro ta com um barulho esquisito", "sera que e a correia",
        ],
        resolver: respostaSempreEscalar(
          "Prefiro não arriscar um diagnóstico por aqui sem ver o veículo — posso te conectar com a equipe para uma avaliação correta?",
        ),
      },
      {
        id: "prazo_entrega",
        exemplosDeFrase: [
          "quando fica pronto", "quanto tempo demora", "qual o prazo", "demora quanto tempo pra ficar pronto",
          "em quanto tempo fica pronto", "prazo de entrega",
        ],
        resolver: respostaSempreEscalar(
          "O prazo depende da avaliação do veículo — posso confirmar isso com a equipe assim que você trouxer o carro.",
        ),
      },
    ],
  },
  {
    // Fase 3 — segmento 3/13 (homologação própria, ver
    // docs/ia-universal-segmento-restaurante-v1.md).
    chave: "restaurante",
    nomesAlternativos: ["restaurante", "lanchonete", "pizzaria", "hamburgueria"],
    vocabularioReconhecido: [
      "cardapio", "prato do dia", "marmita", "bebida", "sobremesa",
      "delivery", "entrega", "retirada", "taxa de entrega", "area de entrega",
      "reserva", "mesa", "pix", "forma de pagamento", "tempo de preparo", "demora", "aberto",
      "vegetariano", "vegano",
    ],
    intencoesAdicionais: [
      // ── Consulta dado real (mesmo `dados.servicos` da Barbearia/Oficina —
      // um restaurante cadastra itens de cardápio como "serviços", mesmo
      // conceito genérico, nenhuma tabela nova). Diferente das outras duas,
      // aqui a resposta LISTA os itens em vez de só confirmar sim/não —
      // ainda assim só lê `dados.servicos`, nunca inventa um prato.
      {
        id: "cardapio_pratos",
        exemplosDeFrase: [
          "cardapio", "prato do dia", "tem marmita", "quais pratos", "o que tem hoje",
          "cardapio de hoje", "tem marmita hoje", "qual o prato do dia",
          "opcao vegetariana", "opcao vegana", "tem prato vegetariano", "tem prato vegano",
        ],
        resolver: (dados) => respostaListaServicos(
          dados, "Hoje temos",
          "No momento não tenho o cardápio confirmado aqui, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "bebidas",
        exemplosDeFrase: ["tem bebida", "quais bebidas", "tem refrigerante", "tem suco", "vendem bebida"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["bebida", "refrigerante", "suco", "refri"],
          "Sim, temos bebidas! Posso te passar as opções com a equipe.",
          "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "sobremesas",
        exemplosDeFrase: ["tem sobremesa", "quais sobremesas", "tem doce", "servem sobremesa"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["sobremesa", "doce"],
          "Sim, temos sobremesas! Posso te passar as opções com a equipe.",
          "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "delivery",
        // De propósito sem "entregam" solto aqui — colidiria com perguntas de
        // área/cobertura ("vocês entregam aqui no meu bairro?"), que precisam
        // cair em `area_atendimento`, não aqui. Ver seção de bugs no doc de
        // homologação deste segmento.
        exemplosDeFrase: ["fazem entrega", "tem delivery", "faz entrega", "tem entrega"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["delivery", "entrega"],
          "Sim, fazemos entrega! Posso confirmar os detalhes com a equipe.",
          "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "retirada",
        exemplosDeFrase: ["fazem retirada", "tem retirada", "posso retirar", "retirada no local"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["retirada"],
          "Sim, temos retirada no local! Posso te ajudar a confirmar.",
          "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      // ── Sempre escala — nenhum dado desta fase cobre taxa de entrega, área
      // atendida, forma de pagamento, tempo de preparo ou disponibilidade de
      // mesa. "Não criar nova arquitetura" nesta missão, então a resposta
      // honesta é sempre encaminhar, nunca estimar (mesmo padrão de
      // respostaSempreEscalar já usado em diagnóstico/prazo da Oficina).
      {
        id: "taxa_entrega",
        exemplosDeFrase: ["taxa de entrega", "qual a taxa", "quanto e o frete", "cobra taxa de entrega"],
        resolver: respostaSempreEscalar(
          "Não tenho a taxa de entrega confirmada aqui — posso te conectar com a equipe para confirmar?",
        ),
      },
      {
        id: "area_atendimento",
        exemplosDeFrase: [
          "entrega aqui", "entregam aqui", "entregam na minha regiao", "atende meu bairro",
          "area de entrega", "meu bairro", "minha regiao",
        ],
        resolver: respostaSempreEscalar(
          "Não tenho a área de entrega confirmada aqui — posso te conectar com a equipe para confirmar?",
        ),
      },
      {
        id: "formas_pagamento",
        exemplosDeFrase: ["aceita pix", "aceita cartao", "posso pagar com pix", "forma de pagamento", "aceitam pix"],
        resolver: respostaSempreEscalar(
          "Não tenho as formas de pagamento confirmadas aqui — posso te conectar com a equipe para confirmar?",
        ),
      },
      {
        id: "tempo_preparo",
        exemplosDeFrase: ["tempo de preparo", "demora", "quanto tempo pra ficar pronto o pedido"],
        resolver: respostaSempreEscalar(
          "O tempo de preparo pode variar — posso te conectar com a equipe para confirmar?",
        ),
      },
      {
        id: "reserva_mesa",
        exemplosDeFrase: ["tem mesa", "mesa pra", "querem fazer reserva", "tem mesa disponivel", "reserva de mesa"],
        resolver: respostaSempreEscalar(
          "Não tenho a disponibilidade de mesas em tempo real aqui — posso te conectar com a equipe para confirmar?",
        ),
      },
      // ── Reaproveita `dados.horario` (já usado pela Camada 1) — sem campo
      // novo. Só existe aqui porque "aberto agora?" não bate com o regex
      // universal de horário (\babre\b não casa com "aberto").
      {
        id: "aberto_agora",
        exemplosDeFrase: ["aberto agora", "ta aberto", "esta aberto", "abertos agora", "voces estao abertos"],
        resolver: (dados) => dados.horario
          ? `Nosso horário de atendimento é: ${dados.horario}. Se quiser, posso confirmar certinho com a equipe se estamos abertos agora.`
          : null,
      },
    ],
  },
  {
    // Fase 3 — segmento 10/13 (homologação própria, ver
    // docs/ia-universal-segmento-clinica-v1.md).
    chave: "clinica",
    nomesAlternativos: ["clinica", "consultorio", "clinica medica", "clinica odontologica"],
    vocabularioReconhecido: [
      "convenio", "procedimento", "exame", "especialidade medica",
      "diagnostico", "o que eu tenho", "exame deu alterado", "que remedio", "posso tomar",
      "como eu trato", "o que eu faco pra melhorar",
    ],
    intencoesAdicionais: [
      // ── Consulta dado real ──
      {
        id: "atende_convenio",
        exemplosDeFrase: ["atende convenio", "aceita convenio", "atende plano de saude"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["convenio", "plano de saude"],
          "Sim, atendemos por convênio! Posso te ajudar a confirmar os detalhes com a equipe.",
          "No momento não tenho essa informação confirmada, mas posso verificar com a equipe para você.",
        ),
      },
      {
        id: "especialidades_geral",
        exemplosDeFrase: ["quais especialidades", "tem especialidades", "especialidades disponiveis"],
        resolver: (dados) => respostaListaServicos(
          dados, "Atendemos em",
          "No momento não tenho as especialidades confirmadas aqui, mas posso confirmar com a equipe para você.",
        ),
      },
      // ── Sempre escala — nunca diagnosticar, interpretar exame, indicar
      // medicamento ou orientar tratamento sem avaliação. Atenção explícita
      // pedida pelo Diretor para este segmento.
      {
        id: "diagnostico_medico",
        exemplosDeFrase: ["o que eu tenho", "isso pode ser o que", "esses sintomas sao de que", "sera que e grave"],
        resolver: respostaSempreEscalar(
          "Não posso avaliar sintomas ou dar um diagnóstico por aqui — isso exige uma consulta com o profissional. Posso te conectar com a equipe?",
        ),
      },
      {
        id: "interpretacao_exame",
        exemplosDeFrase: ["meu exame deu alterado", "esse resultado e grave", "o que esse exame significa", "meu exame veio"],
        resolver: respostaSempreEscalar(
          "Não posso interpretar resultado de exame por aqui — isso precisa ser avaliado pelo profissional. Posso te conectar com a equipe?",
        ),
      },
      {
        id: "indicacao_medicamento",
        exemplosDeFrase: ["que remedio eu tomo", "posso tomar", "qual medicamento", "pode me indicar um remedio"],
        resolver: respostaSempreEscalar(
          "Não posso indicar medicamento por aqui — isso precisa ser avaliado pelo profissional. Posso te conectar com a equipe?",
        ),
      },
      {
        id: "orientacao_tratamento_sem_avaliacao",
        exemplosDeFrase: ["como eu trato isso", "o que eu faco pra melhorar", "qual tratamento eu sigo"],
        resolver: respostaSempreEscalar(
          "Não posso orientar um tratamento sem uma avaliação — posso te conectar com a equipe para agendar uma consulta?",
        ),
      },
    ],
  },
  {
    // Fase 3 — segmento 4/13 (homologação própria, ver
    // docs/ia-universal-segmento-pet-shop-v1.md).
    chave: "pet_shop",
    nomesAlternativos: ["pet shop", "petshop", "pet"],
    vocabularioReconhecido: [
      "banho", "tosa", "vacina", "veterinari", "hotel", "hotelzinho", "creche",
      "racao", "acessorio", "produto", "gato", "felino",
      "busca em casa", "busca a domicilio", "entrega",
      "remedio", "medicamento", "vermifugo", "antipulgas",
      "estoque", "vaga", "disponibilidade", "forma de pagamento", "pix",
      "doente", "vomitando", "machucou",
    ],
    intencoesAdicionais: [
      // ── Consulta dado real (mesmo `dados.servicos`) ──
      {
        id: "banho",
        exemplosDeFrase: ["banho", "precisa de banho", "fazem banho", "tem banho"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["banho"],
          "Sim, fazemos banho! Posso te ajudar a agendar.",
          "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "tosa",
        exemplosDeFrase: ["tosa", "fazem tosa", "tosa higienica", "tem tosa"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["tosa"],
          "Sim, fazemos tosa! Posso te ajudar a agendar.",
          "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "vacinacao",
        exemplosDeFrase: ["voces vacinam", "fazem vacinacao", "tem vacinacao", "aplicam vacina", "fazem vacina"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["vacina"],
          "Sim, fazemos vacinação! Posso te ajudar a agendar.",
          "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "consulta_veterinaria",
        exemplosDeFrase: ["consulta veterinaria", "tem veterinario", "atende com veterinario", "fazem consulta"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["veterinari"],
          "Sim, oferecemos consulta veterinária! Posso te ajudar a agendar.",
          "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "hotel",
        exemplosDeFrase: ["hotel para pet", "tem hotelzinho", "tem hotel", "hospedagem pra cachorro"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["hotel"],
          "Sim, temos hotel para pets! Posso te ajudar a confirmar com a equipe.",
          "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "creche",
        exemplosDeFrase: ["tem creche", "creche para cachorro", "creche pet"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["creche"],
          "Sim, temos creche! Posso te ajudar a confirmar com a equipe.",
          "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "racao",
        exemplosDeFrase: ["tem racao", "racao premium", "vendem racao", "tem racao premium"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["racao"],
          "Sim, temos ração! Posso te ajudar a confirmar a marca com a equipe.",
          "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "acessorios",
        exemplosDeFrase: ["tem acessorio", "vendem acessorio", "tem coleira", "tem guia"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["acessorio"],
          "Sim, temos acessórios! Posso te ajudar a confirmar com a equipe.",
          "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "produtos_geral",
        exemplosDeFrase: ["quais produtos", "tem produtos", "vendem produtos", "produtos disponiveis"],
        resolver: (dados) => respostaListaServicos(
          dados, "Temos",
          "No momento não tenho os produtos confirmados aqui, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "aceita_gato",
        exemplosDeFrase: ["aceita gato", "atende gato", "e pra gato tambem", "tem servico pra gato"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["gato", "felino"],
          "Sim, atendemos gatos! Posso te ajudar a confirmar com a equipe.",
          "No momento não tenho essa informação confirmada, mas posso verificar com a equipe para você.",
        ),
      },
      {
        id: "busca_em_casa",
        exemplosDeFrase: ["busca em casa", "busca a domicilio", "buscam em casa", "vem buscar"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["busca"],
          "Sim, buscamos em casa! Posso te ajudar a confirmar com a equipe.",
          "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "entrega_produtos",
        exemplosDeFrase: ["fazem entrega", "tem entrega", "entregam produtos", "entrega em casa"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["entrega", "delivery"],
          "Sim, fazemos entrega! Posso te ajudar a confirmar com a equipe.",
          "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      // ── Sempre escala — nunca diagnostica, nunca confirma vacina/medicamento
      // específico, estoque ou vaga, mesmo que pareça uma pergunta simples.
      {
        id: "vacina_especifica",
        exemplosDeFrase: [
          "vacina antirrabica", "tem vacina disponivel", "vacina v10", "vacina v8",
          "qual vacina voces tem", "tem estoque de vacina",
        ],
        resolver: respostaSempreEscalar(
          "Não tenho a disponibilidade de vacinas específicas confirmada aqui — posso te conectar com a equipe para confirmar?",
        ),
      },
      {
        id: "medicamentos",
        exemplosDeFrase: ["tem remedio", "vendem medicamento", "tem antipulgas", "tem vermifugo"],
        resolver: respostaSempreEscalar(
          "Não tenho a disponibilidade de medicamentos confirmada aqui — posso te conectar com a equipe para confirmar?",
        ),
      },
      {
        id: "diagnostico_veterinario",
        exemplosDeFrase: [
          "meu cachorro esta com", "meu gato esta com", "o que pode ser", "esta doente",
          "nao esta comendo", "esta vomitando", "machucou a pata",
        ],
        resolver: respostaSempreEscalar(
          "Prefiro não arriscar uma avaliação por aqui sem ver o animal — posso te conectar com a equipe para uma avaliação correta?",
        ),
      },
      {
        id: "estoque_geral",
        exemplosDeFrase: ["tem estoque", "tem em estoque", "disponivel agora"],
        resolver: respostaSempreEscalar(
          "Não tenho o estoque confirmado em tempo real aqui — posso te conectar com a equipe para confirmar?",
        ),
      },
      {
        id: "disponibilidade_hotel_creche",
        exemplosDeFrase: ["tem vaga no hotel", "tem vaga na creche", "disponibilidade de hotel", "tem lugar pro meu cachorro"],
        resolver: respostaSempreEscalar(
          "Não tenho a disponibilidade de vagas em tempo real aqui — posso te conectar com a equipe para confirmar?",
        ),
      },
      {
        id: "formas_pagamento",
        exemplosDeFrase: ["aceita pix", "aceita cartao", "posso pagar com pix", "forma de pagamento"],
        resolver: respostaSempreEscalar(
          "Não tenho as formas de pagamento confirmadas aqui — posso te conectar com a equipe para confirmar?",
        ),
      },
    ],
  },
  {
    // Fase 3 — segmento 8/13 (homologação própria, ver
    // docs/ia-universal-segmento-academia-v1.md).
    chave: "academia",
    nomesAlternativos: ["academia", "estudio de treino", "box de crossfit", "crossfit"],
    vocabularioReconhecido: [
      "aula experimental", "musculacao", "personal", "matricula", "crossfit",
      "lesao", "machuquei", "contraindicacao", "pressao alta", "suplemento", "whey", "creatina",
      "monta um treino", "qual treino", "quantas series", "prescricao",
    ],
    intencoesAdicionais: [
      // ── Consulta dado real ──
      {
        id: "aula_experimental",
        exemplosDeFrase: ["aula experimental", "aula gratis", "aula teste"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["aula experimental", "aula gratis"],
          "Sim, temos aula experimental! Posso te ajudar a agendar.",
          "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "musculacao",
        exemplosDeFrase: ["tem musculacao", "fazem musculacao", "tem sala de musculacao"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["musculacao"],
          "Sim, temos musculação! Posso te ajudar a confirmar com a equipe.",
          "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "personal",
        exemplosDeFrase: ["tem personal", "oferecem personal", "tem personal trainer"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["personal"],
          "Sim, oferecemos personal! Posso te ajudar a confirmar com a equipe.",
          "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "planos_matricula",
        exemplosDeFrase: ["quais planos", "tem plano", "valores de matricula", "planos de matricula"],
        resolver: (dados) => respostaListaServicos(
          dados, "Temos",
          "No momento não tenho os planos confirmados aqui, mas posso confirmar com a equipe para você.",
        ),
      },
      // ── Sempre escala — nunca avaliar lesão, contraindicação, recomendar
      // suplemento ou prescrever treino, mesmo que pareça simples. Atenção
      // explícita pedida pelo Diretor para este segmento.
      {
        id: "lesao",
        exemplosDeFrase: ["machuquei", "tive uma lesao", "sinto dor no", "posso treinar machucado"],
        resolver: respostaSempreEscalar(
          "Não posso avaliar lesões por aqui — recomendo conversar com um profissional antes de treinar. Posso te conectar com a equipe?",
        ),
      },
      {
        id: "contraindicacao",
        exemplosDeFrase: ["contraindicacao", "posso treinar mesmo com", "pressao alta", "e seguro treinar com"],
        resolver: respostaSempreEscalar(
          "Não posso avaliar contraindicações por aqui — isso depende de uma avaliação individual com um profissional. Posso te conectar com a equipe?",
        ),
      },
      {
        id: "suplementacao",
        exemplosDeFrase: ["qual suplemento", "posso tomar whey", "qual creatina", "devo tomar suplemento"],
        resolver: respostaSempreEscalar(
          "Não posso recomendar suplementação por aqui — isso exige orientação de um profissional. Posso te conectar com a equipe?",
        ),
      },
      {
        id: "prescricao_treino",
        exemplosDeFrase: ["monta um treino", "qual treino eu devo fazer", "quantas series eu faco", "me passa um treino"],
        resolver: respostaSempreEscalar(
          "Não posso montar ou prescrever um treino por aqui — isso precisa de avaliação de um profissional. Posso te conectar com a equipe?",
        ),
      },
    ],
  },
  {
    // Fase 3 — segmento 6/13 (homologação própria, ver
    // docs/ia-universal-segmento-imobiliaria-v1.md).
    chave: "imobiliaria",
    nomesAlternativos: ["imobiliaria", "corretora de imoveis", "corretor de imoveis"],
    vocabularioReconhecido: [
      "imovel", "aluguel", "venda de imovel", "avaliacao", "condominio",
      "bairro", "regiao", "metragem", "quartos", "visitar",
    ],
    intencoesAdicionais: [
      // ── Consulta dado real ──
      {
        id: "aluguel",
        exemplosDeFrase: ["trabalham com aluguel", "fazem aluguel", "tem imovel pra alugar"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["aluguel"],
          "Sim, trabalhamos com aluguel! Posso te ajudar a confirmar com a equipe.",
          "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "venda",
        exemplosDeFrase: ["trabalham com venda", "fazem venda de imovel", "vendem imovel"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["venda"],
          "Sim, trabalhamos com venda de imóveis! Posso te ajudar a confirmar com a equipe.",
          "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "avaliacao_imovel",
        exemplosDeFrase: ["fazem avaliacao", "avaliar meu imovel", "avaliacao de imovel", "avaliam imovel"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["avaliacao"],
          "Sim, fazemos avaliação de imóveis! Posso te ajudar a confirmar com a equipe.",
          "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "administracao_condominio",
        exemplosDeFrase: ["administram condominio", "fazem administracao de condominio", "cuidam de condominio"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["condominio"],
          "Sim, fazemos administração de condomínio! Posso te ajudar a confirmar com a equipe.",
          "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      // ── Sempre escala — nenhum dado de inventário/vagas de imóvel
      // específico nesta fase; nunca confirma disponibilidade real.
      {
        id: "disponibilidade_imovel",
        exemplosDeFrase: [
          "tem imovel disponivel", "tem apartamento disponivel", "tem casa disponivel",
          "imovel na regiao", "tem alguma opcao no bairro", "quantos quartos", "qual a metragem",
        ],
        resolver: respostaSempreEscalar(
          "Não tenho a disponibilidade de imóveis em tempo real aqui — posso te conectar com a equipe para confirmar?",
        ),
      },
      {
        id: "visita_imovel",
        exemplosDeFrase: ["quero visitar o imovel", "posso visitar", "ver o imovel pessoalmente", "conhecer o imovel"],
        resolver: respostaSempreEscalar(
          "Posso confirmar a visita com a equipe para você.",
        ),
      },
    ],
  },
  {
    // Fase 3 — segmento 7/13 (homologação própria, ver
    // docs/ia-universal-segmento-contabilidade-v1.md).
    chave: "contador",
    nomesAlternativos: ["contabilidade", "contador", "escritorio contabil"],
    vocabularioReconhecido: [
      "mei", "declaracao de ir", "declarar", "imposto de renda", "abertura de empresa",
      "folha de pagamento", "regime tributario", "sonegacao", "quanto vou pagar de imposto",
      "prazo da declaracao", "contador",
    ],
    intencoesAdicionais: [
      // ── Consulta dado real ──
      {
        id: "abertura_empresa",
        exemplosDeFrase: ["abrem mei", "abertura de mei", "abrir empresa", "abrem empresa", "fazem abertura de empresa"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["mei", "abertura"],
          "Sim, fazemos abertura de empresa/MEI! Posso te ajudar a confirmar com a equipe.",
          "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "declaracao_ir",
        exemplosDeFrase: ["declaracao de ir", "fazem declaracao", "imposto de renda", "fazem a declaracao de imposto"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["declaracao", "imposto de renda"],
          "Sim, fazemos declaração de Imposto de Renda! Posso te ajudar a confirmar com a equipe.",
          "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "folha_pagamento",
        exemplosDeFrase: ["folha de pagamento", "fazem folha", "cuidam da folha de pagamento"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["folha"],
          "Sim, cuidamos da folha de pagamento! Posso te ajudar a confirmar com a equipe.",
          "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      // ── Sempre escala — nunca dar orientação fiscal específica nem
      // prometer prazo, mesmo que pareça uma dúvida simples.
      {
        id: "orientacao_fiscal_especifica",
        exemplosDeFrase: [
          "quanto vou pagar de imposto", "como pagar menos imposto", "qual regime tributario",
          "e crime sonegar", "sonegacao", "qual o melhor regime pra mim",
        ],
        resolver: respostaSempreEscalar(
          "Não posso dar uma orientação fiscal específica por aqui — isso depende da análise do seu caso. Posso te conectar com a equipe para uma avaliação correta?",
        ),
      },
      {
        id: "prazo_declaracao",
        exemplosDeFrase: ["prazo da declaracao", "declarar", "qual o prazo pra declarar"],
        resolver: respostaSempreEscalar(
          "O prazo pode variar conforme o ano e sua situação — posso te conectar com a equipe para confirmar?",
        ),
      },
    ],
  },
  {
    // Fase 3 — segmento 9/13 (homologação própria, ver
    // docs/ia-universal-segmento-estetica-v1.md).
    chave: "estetica",
    nomesAlternativos: ["estetica", "clinica de estetica", "studio de estetica"],
    vocabularioReconhecido: [
      "limpeza de pele", "botox", "preenchimento", "peeling", "procedimento",
      "oleosa", "pele seca", "mancha", "contraindicacao", "garante o resultado",
      "quantas sessoes", "tipo de pele", "qual tratamento", "gravida",
    ],
    intencoesAdicionais: [
      // ── Consulta dado real ──
      {
        id: "limpeza_pele",
        exemplosDeFrase: ["limpeza de pele", "fazem limpeza de pele", "limpeza facial"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["limpeza de pele", "limpeza facial"],
          "Sim, fazemos limpeza de pele! Posso te ajudar a agendar.",
          "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "botox",
        exemplosDeFrase: ["fazem botox", "tem botox", "aplicam botox"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["botox"],
          "Sim, fazemos botox! Posso te ajudar a agendar uma avaliação com a equipe.",
          "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "preenchimento",
        exemplosDeFrase: ["fazem preenchimento", "tem preenchimento"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["preenchimento"],
          "Sim, fazemos preenchimento! Posso te ajudar a agendar uma avaliação com a equipe.",
          "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "peeling",
        exemplosDeFrase: ["fazem peeling", "tem peeling"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["peeling"],
          "Sim, fazemos peeling! Posso te ajudar a agendar.",
          "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "procedimentos_geral",
        exemplosDeFrase: ["quais procedimentos", "tem procedimentos", "procedimentos disponiveis"],
        resolver: (dados) => respostaListaServicos(
          dados, "Trabalhamos com",
          "No momento não tenho os procedimentos confirmados aqui, mas posso confirmar com a equipe para você.",
        ),
      },
      // ── Sempre escala — nunca diagnosticar tipo de pele/causa, nunca
      // avaliar contraindicação, nunca garantir resultado. Toda resposta
      // reforça que o procedimento exige avaliação individual (atenção
      // explícita pedida pelo Diretor para este segmento).
      {
        id: "diagnostico_estetico",
        exemplosDeFrase: ["oleosa", "que tipo de pele eu tenho", "o que esta causando essa mancha", "qual tratamento"],
        resolver: respostaSempreEscalar(
          "Não posso avaliar seu tipo de pele ou indicar um tratamento por aqui — isso exige uma avaliação individual com a equipe. Posso te conectar com a equipe?",
        ),
      },
      {
        id: "contraindicacao_estetica",
        exemplosDeFrase: ["posso fazer botox gravida", "tem contraindicacao", "posso fazer esse procedimento tomando"],
        resolver: respostaSempreEscalar(
          "Não posso avaliar contraindicações por aqui — isso depende de uma avaliação individual com a equipe. Posso te conectar com a equipe?",
        ),
      },
      {
        id: "resultado_garantido",
        exemplosDeFrase: ["garante o resultado", "vai tirar todas as", "quantas sessoes pra sumir", "tem garantia de resultado"],
        resolver: respostaSempreEscalar(
          "Resultados podem variar de pessoa para pessoa — não posso garantir um resultado específico por aqui. Recomendo uma avaliação individual com a equipe.",
        ),
      },
    ],
  },
  {
    // Fase 3 — segmento 12/13 (homologação própria, ver
    // docs/ia-universal-segmento-fisioterapia-v1.md).
    chave: "fisioterapia",
    nomesAlternativos: ["fisioterapia", "clinica de fisioterapia", "fisioterapeuta"],
    vocabularioReconhecido: [
      "rpg", "encaminhamento medico", "sessao de fisioterapia",
      "machucou", "machuquei", "essa dor", "qual exercicio", "me passa um exercicio",
      "tempo de recuperacao", "quanto tempo leva", "quantas sessoes",
    ],
    intencoesAdicionais: [
      // ── Consulta dado real ──
      {
        id: "rpg",
        exemplosDeFrase: ["fazem rpg", "tem rpg", "trabalham com rpg"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["rpg"],
          "Sim, trabalhamos com RPG! Posso te ajudar a agendar.",
          "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "tipos_fisioterapia",
        exemplosDeFrase: ["quais tipos de fisioterapia", "quais tratamentos voces fazem", "tipos de sessao"],
        resolver: (dados) => respostaListaServicos(
          dados, "Trabalhamos com",
          "No momento não tenho os tratamentos confirmados aqui, mas posso confirmar com a equipe para você.",
        ),
      },
      // ── Sempre escala — nunca avaliar lesão, prescrever exercício
      // individualizado, estimar prazo de recuperação, ou confirmar
      // necessidade de encaminhamento médico sem checar com a equipe.
      {
        id: "avaliacao_lesao",
        exemplosDeFrase: ["machucou", "essa dor e grave", "o que pode ser essa dor", "machuquei o ombro"],
        resolver: respostaSempreEscalar(
          "Não posso avaliar uma lesão por aqui — isso precisa ser visto pelo profissional. Posso te conectar com a equipe para uma avaliação?",
        ),
      },
      {
        id: "prescricao_exercicio",
        exemplosDeFrase: ["qual exercicio eu faco", "me passa um exercicio", "que exercicio ajuda", "monta um exercicio"],
        resolver: respostaSempreEscalar(
          "Não posso prescrever um exercício individualizado por aqui — isso depende de uma avaliação com o profissional. Posso te conectar com a equipe?",
        ),
      },
      {
        id: "tempo_recuperacao",
        exemplosDeFrase: ["tempo de recuperacao", "quanto tempo leva pra recuperar", "quantas sessoes ate melhorar", "em quanto tempo eu fico bom"],
        resolver: respostaSempreEscalar(
          "O tempo de recuperação varia de pessoa para pessoa — não posso estimar isso por aqui. Posso te conectar com a equipe para uma avaliação?",
        ),
      },
      {
        id: "precisa_encaminhamento",
        exemplosDeFrase: ["precisa de encaminhamento", "precisa de pedido medico"],
        resolver: respostaSempreEscalar(
          "Não tenho essa informação confirmada aqui — posso verificar com a equipe se é necessário encaminhamento médico para o seu caso.",
        ),
      },
    ],
  },
  {
    // Fase 3 — segmento 11/13 (homologação própria, ver
    // docs/ia-universal-segmento-psicologia-v1.md).
    chave: "psicologia",
    nomesAlternativos: ["psicologia", "clinica de psicologia", "psicologo", "psicologa"],
    vocabularioReconhecido: [
      "atendimento online", "atende online", "abordagem terapeutica", "terapia",
      "tenho ansiedade", "tenho depressao", "isso e transtorno", "esses sintomas",
      "me ajuda a resolver", "nao aguento mais", "penso em me machucar", "nao vejo sentido",
    ],
    intencoesAdicionais: [
      // ── Sinal de crise vem PRIMEIRO no array — se a mensagem tocar em
      // linguagem de risco, isso tem prioridade sobre qualquer outra
      // intenção deste módulo, mesmo que também mencione sintoma/diagnóstico.
      {
        id: "situacao_de_crise",
        exemplosDeFrase: ["nao aguento mais", "penso em me machucar", "nao vejo sentido", "quero desistir de tudo"],
        resolver: respostaSempreEscalar(
          "O que você está sentindo é importante, e você não precisa passar por isso sozinho(a). Vou te conectar agora com a equipe para que alguém possa te ajudar.",
        ),
      },
      // ── Consulta dado real ──
      {
        id: "atende_online",
        exemplosDeFrase: ["atende online", "sessao online", "terapia online"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["online"],
          "Sim, atendemos online! Posso te ajudar a agendar.",
          "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "abordagens_geral",
        exemplosDeFrase: ["quais abordagens", "qual abordagem voces usam", "trabalham com tcc", "trabalham com psicanalise"],
        resolver: (dados) => respostaListaServicos(
          dados, "Trabalhamos com",
          "No momento não tenho as abordagens confirmadas aqui, mas posso confirmar com a equipe para você.",
        ),
      },
      // ── Sempre escala — nunca diagnosticar transtorno, nunca interpretar
      // sintoma como diagnóstico, nunca substituir o atendimento em si.
      {
        id: "diagnostico_transtorno",
        exemplosDeFrase: ["tenho ansiedade", "tenho depressao", "isso e transtorno", "acho que tenho"],
        resolver: respostaSempreEscalar(
          "Não posso diagnosticar por aqui — isso exige uma avaliação com o profissional. Posso te conectar com a equipe?",
        ),
      },
      {
        id: "interpretacao_sintoma",
        exemplosDeFrase: ["esses sintomas", "o que pode ser esse sentimento", "sera que e normal eu sentir"],
        resolver: respostaSempreEscalar(
          "Não posso interpretar sintomas por aqui — isso é algo para conversar com o profissional. Posso te conectar com a equipe?",
        ),
      },
      {
        id: "substituir_atendimento",
        exemplosDeFrase: ["me ajuda a resolver isso agora", "me da uma orientacao psicologica", "pode me aconselhar sobre"],
        resolver: respostaSempreEscalar(
          "Não posso substituir o atendimento psicológico por aqui — recomendo conversar diretamente com o profissional. Posso te conectar com a equipe?",
        ),
      },
    ],
  },
  {
    // Fase 3 — segmento 13/13 (homologação própria, ver
    // docs/ia-universal-segmento-veterinaria-v1.md). Último dos 13 segmentos.
    chave: "veterinaria",
    nomesAlternativos: ["veterinaria", "clinica veterinaria", "veterinario"],
    vocabularioReconhecido: [
      "emergencia", "vacinacao", "castracao",
      "meu cachorro esta com", "meu gato esta com", "que remedio", "quantos ml",
      "levar ao veterinario", "resolver sem ir",
    ],
    intencoesAdicionais: [
      // ── Consulta dado real ──
      {
        id: "emergencia_24h",
        exemplosDeFrase: ["emergencia 24h", "atende emergencia", "plantao 24 horas"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["emergencia", "24h", "plantao"],
          "Sim, atendemos emergência! Posso te ajudar a confirmar com a equipe.",
          "No momento não tenho isso confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "castracao",
        exemplosDeFrase: ["fazem castracao", "tem castracao", "castram animal"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["castracao"],
          "Sim, fazemos castração! Posso te ajudar a agendar.",
          "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      {
        id: "vacinacao_clinica",
        exemplosDeFrase: ["fazem vacinacao", "voces vacinam", "tem vacinacao"],
        resolver: (dados) => respostaDisponibilidadeServico(
          dados, ["vacina"],
          "Sim, fazemos vacinação! Posso te ajudar a agendar.",
          "No momento não tenho esse serviço confirmado na nossa lista, mas posso confirmar com a equipe para você.",
        ),
      },
      // ── Sempre escala — nunca diagnosticar doença, indicar medicamento,
      // orientar dosagem ou substituir a consulta veterinária em si.
      {
        id: "diagnostico_doenca",
        exemplosDeFrase: ["meu cachorro esta com", "meu gato esta com", "o que ele pode ter", "isso e grave"],
        resolver: respostaSempreEscalar(
          "Não posso diagnosticar por aqui sem ver o animal — isso exige avaliação do veterinário. Posso te conectar com a equipe?",
        ),
      },
      {
        id: "indicacao_medicamento_veterinario",
        exemplosDeFrase: ["que remedio eu dou", "posso dar remedio", "qual medicamento pra ele"],
        resolver: respostaSempreEscalar(
          "Não posso indicar medicamento por aqui — isso precisa ser avaliado pelo veterinário. Posso te conectar com a equipe?",
        ),
      },
      {
        id: "orientacao_dosagem",
        exemplosDeFrase: ["quantos ml eu dou", "qual a dose", "quanto eu dou desse remedio"],
        resolver: respostaSempreEscalar(
          "Não posso orientar dosagem por aqui — isso precisa ser avaliado pelo veterinário. Posso te conectar com a equipe?",
        ),
      },
      {
        id: "substituir_consulta_veterinaria",
        exemplosDeFrase: ["levar ao veterinario", "resolver sem ir", "preciso mesmo levar"],
        resolver: respostaSempreEscalar(
          "Não posso substituir a consulta veterinária por aqui — recomendo levar o animal para avaliação. Posso te conectar com a equipe?",
        ),
      },
    ],
  },
];

/**
 * Mapeia o texto livre já cadastrado em `clinicas.especialidade` para um
 * módulo de segmento. Sem correspondência conhecida → módulo "generico"
 * (nunca lança erro, nunca inventa um segmento não informado pela empresa).
 */
export function resolverModuloSegmento(especialidadeTexto: string | null | undefined): ModuloSegmento {
  if (!especialidadeTexto?.trim()) return MODULO_GENERICO;
  const alvo = normalizarUniversal(especialidadeTexto);

  // Escolhe o nome alternativo mais ESPECÍFICO (mais longo) que aparece no
  // texto, não o primeiro módulo do array — "clinica" (módulo Clínica) é
  // substring de "clinica veterinaria"/"clinica de estetica"/"clinica de
  // fisioterapia"/"clinica de psicologia", então um match por ordem de
  // array levaria tudo isso para o módulo médico por engano. Bug real
  // encontrado pelos testes desta fase, não só uma correção de teste.
  let melhor: { modulo: ModuloSegmento; tamanho: number } | null = null;
  for (const modulo of MODULOS) {
    for (const nome of modulo.nomesAlternativos) {
      const nomeNorm = normalizarUniversal(nome);
      if (alvo.includes(nomeNorm) && (!melhor || nomeNorm.length > melhor.tamanho)) {
        melhor = { modulo, tamanho: nomeNorm.length };
      }
    }
  }
  return melhor ? melhor.modulo : MODULO_GENERICO;
}

export const MODULOS_SEGMENTO_DISPONIVEIS = MODULOS;
export { MODULO_GENERICO };
