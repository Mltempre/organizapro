// ── Famílias visuais do Site Premium ────────────────────────────────────────
//
// Um único sistema de componentes, quatro identidades diferentes — a mesma
// arquitetura que já funcionou na IA Universal (13 segmentos, 1 arquitetura,
// zero duplicação de lógica), agora aplicada à camada visual.
//
// Cada família muda cor, densidade emocional e leve variação de forma — nunca
// estrutura, nunca dado. A escolha de família nunca inventa nada sobre a
// empresa: vem exclusivamente do segmento que ela já cadastrou.

export type FamiliaId = "saude" | "autoridade" | "consumo" | "tecnica" | "universal";

export type Tema = {
  id: FamiliaId;
  nome: string;
  // fundo
  ink: string; ink2: string; ink3: string;
  paper: string; paper2: string;
  // cor principal (identidade) / cor emocional (calor humano) / contraste (energia pontual)
  primary: string; primaryDeep: string; primarySoft: string; primaryBorder: string;
  emotional: string; emotionalSoft: string;
  contrast: string; contrastSoft: string;
  // texto
  text: string; textMuted: string; textFaint: string;
  textOnPaper: string; textMutedOnPaper: string;
  // linhas
  line: string; lineOnPaper: string;
  // assinatura de forma (0 = reto/editorial, 1 = mais curvo/acolhedor)
  radius: number;
};

const FAMILIAS: Record<FamiliaId, Tema> = {
  // Clínicas, dentistas, fisioterapeutas, psicólogos, estética.
  // Acolhimento, leveza, confiança — tons luminosos sobre um fundo profundo,
  // nunca frio. Curvas discretas (radius mais alto).
  saude: {
    id: "saude", nome: "Saúde e Cuidado",
    ink: "#172420", ink2: "#1e2f29", ink3: "#0f1815",
    paper: "#f1ede3", paper2: "#e7e0cf",
    primary: "#6fa693", primaryDeep: "#457565", primarySoft: "rgba(111,166,147,.14)", primaryBorder: "rgba(111,166,147,.32)",
    emotional: "#e2a08e", emotionalSoft: "rgba(226,160,142,.16)",
    contrast: "#3d6657", contrastSoft: "rgba(61,102,87,.18)",
    text: "#eef2ee", textMuted: "#a9bcb4", textFaint: "#7c9188",
    textOnPaper: "#20302a", textMutedOnPaper: "#5f6d64",
    line: "rgba(238,242,238,.12)", lineOnPaper: "rgba(32,48,42,.13)",
    radius: 16,
  },
  // Advogados, contadores, imobiliárias, consultorias.
  // Autoridade, solidez, precisão — contraste elegante, linhas retas.
  autoridade: {
    id: "autoridade", nome: "Autoridade e Confiança",
    ink: "#12171d", ink2: "#182027", ink3: "#0b0f13",
    paper: "#f3f1ec", paper2: "#e8e4da",
    primary: "#8a6b3d", primaryDeep: "#6b5127", primarySoft: "rgba(138,107,61,.14)", primaryBorder: "rgba(138,107,61,.32)",
    emotional: "#6b2b3a", emotionalSoft: "rgba(107,43,58,.16)",
    contrast: "#3a4a56", contrastSoft: "rgba(58,74,86,.2)",
    text: "#f1f0ec", textMuted: "#a7aeb6", textFaint: "#78818b",
    textOnPaper: "#1c2126", textMutedOnPaper: "#5a6068",
    line: "rgba(241,240,236,.1)", lineOnPaper: "rgba(28,33,38,.12)",
    radius: 3,
  },
  // Barbearias, restaurantes, academias, pet shops, negócios de experiência.
  // Energia, desejo, autenticidade — a paleta mais intensa e quente.
  consumo: {
    id: "consumo", nome: "Consumo e Experiência",
    ink: "#1c1512", ink2: "#241a15", ink3: "#150f0c",
    paper: "#f2e8d8", paper2: "#e8dac2",
    primary: "#b8863d", primaryDeep: "#8a5f26", primarySoft: "rgba(184,134,61,.14)", primaryBorder: "rgba(184,134,61,.3)",
    emotional: "#8a5560", emotionalSoft: "rgba(138,85,96,.16)",
    contrast: "#6b2b2b", contrastSoft: "rgba(107,43,43,.18)",
    text: "#f2e8d8", textMuted: "#b8a58c", textFaint: "#8a7860",
    textOnPaper: "#241a15", textMutedOnPaper: "#6b5c47",
    line: "rgba(242,232,216,.14)", lineOnPaper: "rgba(36,26,21,.14)",
    radius: 6,
  },
  // Oficinas, prestadores de serviço técnico, manutenção.
  // Competência, agilidade, resultado — contraste forte, formas retas.
  tecnica: {
    id: "tecnica", nome: "Técnica e Resultado",
    ink: "#12161a", ink2: "#182027", ink3: "#0c0f12",
    paper: "#eef0f1", paper2: "#e0e5e7",
    primary: "#3f7ea3", primaryDeep: "#2a5570", primarySoft: "rgba(63,126,163,.15)", primaryBorder: "rgba(63,126,163,.32)",
    emotional: "#d9622b", emotionalSoft: "rgba(217,98,43,.16)",
    contrast: "#22394a", contrastSoft: "rgba(34,57,74,.22)",
    text: "#eef1f3", textMuted: "#a3b0b8", textFaint: "#72828c",
    textOnPaper: "#161e24", textMutedOnPaper: "#556168",
    line: "rgba(238,241,243,.1)", lineOnPaper: "rgba(22,30,36,.12)",
    radius: 4,
  },
  // Sem segmento cadastrado — o mesmo tom neutro-premium que o site já usava
  // antes desta missão. Nunca força uma família que a empresa não escolheu.
  universal: {
    id: "universal", nome: "Universal",
    ink: "#0d1016", ink2: "#10141c", ink3: "#090c11",
    paper: "#f2f0ec", paper2: "#e6e2da",
    primary: "#79bdcd", primaryDeep: "#4f8998", primarySoft: "rgba(55,134,154,.12)", primaryBorder: "rgba(103,187,207,.28)",
    emotional: "#7a8fa8", emotionalSoft: "rgba(122,143,168,.16)",
    contrast: "#1c4d5d", contrastSoft: "rgba(28,77,93,.2)",
    text: "#f8fafc", textMuted: "#9aa8b9", textFaint: "#687589",
    textOnPaper: "#161b1f", textMutedOnPaper: "#565f66",
    line: "rgba(248,250,252,.1)", lineOnPaper: "rgba(22,27,31,.12)",
    radius: 8,
  },
};

// Deriva a família exclusivamente do segmento já cadastrado — nunca inventa
// nada sobre a empresa. Sem segmento reconhecido, cai no tema "universal"
// (o mesmo tom neutro que o site inteiro já usava).
export function resolverFamilia(especialidade?: string | null): Tema {
  const e = (especialidade || "").toLocaleLowerCase("pt-BR");
  if (!e) return FAMILIAS.universal;
  if (/cl[ií]nic|dentist|odont|fisioterap|psic[oó]log|est[ée]tic|sa[uú]de|nutri/.test(e)) return FAMILIAS.saude;
  if (/advoga|advocacia|jur[ií]dic|contab|imobili|consultor/.test(e)) return FAMILIAS.autoridade;
  if (/barbe|restaurant|academia|pet\b|petshop|sal[ãa]o|est[uú]dio de beleza/.test(e)) return FAMILIAS.consumo;
  if (/oficina|mec[âa]nic|veterin[áa]ri|manuten[çc][ãa]o|t[ée]cnic|assist[êe]ncia/.test(e)) return FAMILIAS.tecnica;
  return FAMILIAS.universal;
}

export const font = {
  display: "'Fraunces', Georgia, 'Iowan Old Style', serif",
  body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

export type Tone = "light" | "dark";

// Cada seção "do meio" era travada num único par fundo+texto (clara OU
// escura). Isso quebra o ritmo (alternar claro/escuro) sempre que uma
// seção vizinha some por falta de dado real — o caso comum, não raro,
// já que poucos clientes novos têm Serviços+Equipe+Galeria+Depoimentos+FAQ
// completos. paleta() deixa qualquer seção migrar de polo mantendo o
// contraste correto, para o orquestrador resolver a alternância apenas
// entre as seções que de fato vão aparecer.
export function paleta(tema: Tema, tone: Tone, variant: 1 | 2 = 1) {
  // tema.contrast é escuro (feito para ler sobre paper); tema.primary é claro
  // (feito para ler sobre ink). O acento precisa trocar junto com o fundo,
  // senão um link/ícone fica ilegível ao migrar de polo.
  if (tone === "light") {
    return {
      bg: variant === 1 ? tema.paper : tema.paper2,
      card: variant === 1 ? tema.paper2 : tema.paper,
      text: tema.textOnPaper,
      textMuted: tema.textMutedOnPaper,
      line: tema.lineOnPaper,
      accent: tema.contrast,
    };
  }
  return {
    bg: variant === 1 ? tema.ink : tema.ink2,
    card: variant === 1 ? tema.ink2 : tema.ink,
    text: tema.text,
    textMuted: tema.textMuted,
    line: tema.line,
    accent: tema.primary,
  };
}
