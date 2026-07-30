// ── Cenário canônico — Barbearia Black Crown (conta comercial oficial) ───
// Módulo puro de dados: gera o cenário sempre relativo ao momento da
// chamada (nunca datas fixas gravadas), para que o script de reset possa
// ser rodado a qualquer momento e produzir sempre o mesmo tipo de história
// coerente. Usado por scripts/criar-conta-comercial-demo.mjs (primeira
// carga) e scripts/resetar-conta-comercial-demo.mjs (antes de cada
// apresentação).
//
// Números-alvo (aprovados pelo Diretor, 2026-07-30):
//   18 clientes cadastrados · 11 atendimentos concluídos no mês
//   3 horários vagos hoje · 1 confirmação pendente hoje
//   1 cancelamento sem reagendar · 2 clientes sem retorno 45+ dias
//   4 avaliações aguardando resposta · agenda parcialmente ocupada
//   ≥5 compromissos nos próximos 7 dias (evita o texto "receita prevista"
//   que lib/recomendacoes.ts dispara com 1-4)

function paraDataISO(d) {
  return d.toISOString().slice(0, 10);
}
function diasAtras(hoje, dias) {
  const d = new Date(hoje);
  d.setUTCDate(d.getUTCDate() - dias);
  return paraDataISO(d);
}
function diasNaFrente(hoje, dias) {
  const d = new Date(hoje);
  d.setUTCDate(d.getUTCDate() + dias);
  return paraDataISO(d);
}

const ALEXANDRE = "Alexandre Vasconcelos";
const MATHEUS   = "Matheus Rocha";

const SERVICOS = {
  CORTE:  "Corte Masculino",
  BARBA:  "Barba",
  COMBO:  "Combo Corte + Barba",
  PIGMENTACAO: "Pigmentação de Barba",
};

// Cada cliente já traz seu telefone/whatsapp fixo (faixa dedicada
// 419777700XX, exclusiva desta conta — nunca usada em nenhum outro
// script de teste ou tenant real) e seu papel na história.
export function gerarClientes(agora) {
  const hoje = new Date(agora);
  return [
    { id: "roberto",  nome: "Roberto Cardoso",       tel: "41977770001", proximaConsulta: null },
    { id: "fernando", nome: "Fernando Silveira",     tel: "41977770002", proximaConsulta: paraDataISO(hoje) },
    { id: "eduardo",  nome: "Eduardo Bastos",        tel: "41977770003", proximaConsulta: null },
    { id: "marcos",   nome: "Marcos Antunes",        tel: "41977770004", proximaConsulta: null },
    { id: "diego",    nome: "Diego Ramalho",         tel: "41977770005", proximaConsulta: diasNaFrente(hoje, 4) },
    { id: "lucas",    nome: "Lucas Ferreira",        tel: "41977770006", proximaConsulta: diasNaFrente(hoje, 5) },
    { id: "thiago",   nome: "Thiago Nogueira",       tel: "41977770007", proximaConsulta: diasNaFrente(hoje, 6) },
    { id: "andre",    nome: "André Salgado",         tel: "41977770008", proximaConsulta: diasNaFrente(hoje, 6) },
    { id: "vinicius", nome: "Vinícius Prado",        tel: "41977770009", proximaConsulta: diasNaFrente(hoje, 1) },
    { id: "gustavo",  nome: "Gustavo Meireles",      tel: "41977770010", proximaConsulta: diasNaFrente(hoje, 6) },
    { id: "rodrigo",  nome: "Rodrigo Almeida",       tel: "41977770011", proximaConsulta: diasNaFrente(hoje, 2) },
    { id: "felipe",   nome: "Felipe Duarte",         tel: "41977770012", proximaConsulta: diasNaFrente(hoje, 3) },
    { id: "bruno",    nome: "Bruno Kowalski",        tel: "41977770013", proximaConsulta: diasNaFrente(hoje, 1) },
    { id: "caio",     nome: "Caio Ribas",            tel: "41977770014", proximaConsulta: diasNaFrente(hoje, 2) },
    { id: "otavio",   nome: "Otávio Serra",          tel: "41977770015", proximaConsulta: diasNaFrente(hoje, 3) },
    { id: "henrique", nome: "Henrique Bittencourt",  tel: "41977770016", proximaConsulta: diasNaFrente(hoje, 4) },
    { id: "leandro",  nome: "Leandro Motta",         tel: "41977770017", proximaConsulta: diasNaFrente(hoje, 12) },
    { id: "pedro",    nome: "Pedro Salviano",        tel: "41977770018", proximaConsulta: diasNaFrente(hoje, 18) },
  ];
}

// Agendamentos — cada linha referencia o cliente pelo `id` acima (o script
// de criação resolve nome/telefone reais na hora de inserir).
export function gerarAgendamentos(agora) {
  const hoje = new Date(agora);
  const D = (dias) => dias === 0 ? paraDataISO(hoje) : dias > 0 ? diasNaFrente(hoje, dias) : diasAtras(hoje, -dias);

  return [
    // ── Hoje (5 — 5 de 8 horários das 09h-17h ocupados, 3 vagos) ────────
    { clienteId: "diego",    data: D(0), hora: "09:00", servico: SERVICOS.CORTE,       status: "concluido", profissional: ALEXANDRE },
    { clienteId: "fernando", data: D(0), hora: "11:00", servico: SERVICOS.COMBO,       status: "agendado",  profissional: MATHEUS   },
    { clienteId: "lucas",    data: D(0), hora: "13:00", servico: SERVICOS.BARBA,       status: "confirmado",profissional: MATHEUS   },
    { clienteId: "thiago",   data: D(0), hora: "15:00", servico: SERVICOS.CORTE,       status: "confirmado",profissional: ALEXANDRE },
    { clienteId: "andre",    data: D(0), hora: "16:00", servico: SERVICOS.PIGMENTACAO, status: "concluido", profissional: MATHEUS   },

    // ── Cancelamento sem reagendar (1) ──────────────────────────────────
    { clienteId: "roberto",  data: D(-3), hora: "10:00", servico: SERVICOS.CORTE, status: "cancelado", profissional: ALEXANDRE },

    // ── Reativação — última visita há 45+ dias (2) ──────────────────────
    { clienteId: "eduardo",  data: D(-52), hora: "11:00", servico: SERVICOS.CORTE, status: "concluido", profissional: ALEXANDRE },
    { clienteId: "marcos",   data: D(-58), hora: "14:00", servico: SERVICOS.BARBA, status: "concluido", profissional: MATHEUS   },

    // ── Concluídos este mês, antes de hoje (9 — total do mês = 9 + 2 de hoje = 11) ──
    { clienteId: "rodrigo",  data: D(-3),  hora: "09:00", servico: SERVICOS.CORTE,       status: "concluido", profissional: ALEXANDRE },
    { clienteId: "felipe",   data: D(-5),  hora: "14:00", servico: SERVICOS.BARBA,       status: "concluido", profissional: MATHEUS   },
    { clienteId: "diego",    data: D(-8),  hora: "10:00", servico: SERVICOS.CORTE,       status: "concluido", profissional: ALEXANDRE },
    { clienteId: "lucas",    data: D(-10), hora: "11:00", servico: SERVICOS.COMBO,       status: "concluido", profissional: MATHEUS   },
    { clienteId: "thiago",   data: D(-12), hora: "15:00", servico: SERVICOS.PIGMENTACAO, status: "concluido", profissional: MATHEUS   },
    { clienteId: "andre",    data: D(-14), hora: "09:00", servico: SERVICOS.CORTE,       status: "concluido", profissional: ALEXANDRE },
    { clienteId: "vinicius", data: D(-16), hora: "13:00", servico: SERVICOS.BARBA,       status: "concluido", profissional: MATHEUS   },
    { clienteId: "gustavo",  data: D(-18), hora: "10:00", servico: SERVICOS.CORTE,       status: "concluido", profissional: ALEXANDRE },
    { clienteId: "rodrigo",  data: D(-20), hora: "16:00", servico: SERVICOS.BARBA,       status: "concluido", profissional: MATHEUS   },

    // ── Próximos 7 dias (12 — agenda parcialmente ocupada, nunca cheia) ──
    { clienteId: "vinicius",  data: D(1), hora: "10:00", servico: SERVICOS.CORTE, status: "confirmado", profissional: ALEXANDRE },
    { clienteId: "bruno",     data: D(1), hora: "15:00", servico: SERVICOS.BARBA, status: "confirmado", profissional: MATHEUS   },
    { clienteId: "rodrigo",   data: D(2), hora: "09:00", servico: SERVICOS.CORTE, status: "agendado",   profissional: ALEXANDRE },
    { clienteId: "caio",      data: D(2), hora: "11:00", servico: SERVICOS.COMBO, status: "agendado",   profissional: MATHEUS   },
    { clienteId: "felipe",    data: D(3), hora: "10:00", servico: SERVICOS.BARBA, status: "agendado",   profissional: MATHEUS   },
    { clienteId: "otavio",    data: D(3), hora: "14:00", servico: SERVICOS.CORTE, status: "agendado",   profissional: ALEXANDRE },
    { clienteId: "diego",     data: D(4), hora: "09:00", servico: SERVICOS.COMBO, status: "confirmado", profissional: ALEXANDRE },
    { clienteId: "henrique",  data: D(4), hora: "16:00", servico: SERVICOS.BARBA, status: "agendado",   profissional: MATHEUS   },
    { clienteId: "lucas",     data: D(5), hora: "11:00", servico: SERVICOS.CORTE, status: "agendado",   profissional: ALEXANDRE },
    { clienteId: "thiago",    data: D(6), hora: "13:00", servico: SERVICOS.PIGMENTACAO, status: "confirmado", profissional: MATHEUS },
    { clienteId: "gustavo",   data: D(6), hora: "10:00", servico: SERVICOS.COMBO, status: "confirmado", profissional: ALEXANDRE },
    { clienteId: "andre",     data: D(6), hora: "15:00", servico: SERVICOS.CORTE, status: "agendado",   profissional: MATHEUS   },
  ];
}

// Avaliações — vinculadas às visitas concluídas acima pelo mesmo par
// (clienteId, deltaDias) usado em gerarAgendamentos, para o script de
// criação casar cada avaliação com o agendamento certo.
export function gerarAvaliacoes() {
  return [
    { clienteId: "diego",    agendamentoDelta: 0,   enviadoDelta: 0,  respondeu: false },
    { clienteId: "andre",    agendamentoDelta: 0,   enviadoDelta: 0,  respondeu: false },
    { clienteId: "rodrigo",  agendamentoDelta: -3,  enviadoDelta: -2, respondeu: false },
    { clienteId: "felipe",   agendamentoDelta: -5,  enviadoDelta: -4, respondeu: false },
    { clienteId: "lucas",    agendamentoDelta: -10, enviadoDelta: -9, respondeu: true  },
    { clienteId: "thiago",   agendamentoDelta: -12, enviadoDelta: -11,respondeu: true  },
    { clienteId: "vinicius", agendamentoDelta: -16, enviadoDelta: -15,respondeu: true  },
  ];
}

export { paraDataISO, diasAtras, diasNaFrente, ALEXANDRE, MATHEUS, SERVICOS };
