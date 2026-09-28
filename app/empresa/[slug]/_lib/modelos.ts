// ── Modelos visuais do Site Premium — Aurora, Vértice e Pulse ───────────────
//
// Um único sistema de dados (mesma RPC, mesmas tabelas, mesmo orquestrador) e
// TRÊS composições visuais de verdade. Não é a mesma página com outra cor: cada
// modelo decide base neutra, tipografia, raio, ritmo das seções, composição de
// hero/serviços/galeria e onde a cor aparece.
//
// Separação deliberada de responsabilidades:
//   • families.ts  → COR DA MARCA (o que a empresa já cadastrou como segmento);
//   • modelos.ts   → IDENTIDADE VISUAL (estrutura, tipografia, neutros, raio).
//
// Assim o OrganizaPro atende múltiplos segmentos sem hardcode de nicho nem
// template único: uma barbearia e uma clínica podem usar o MESMO modelo e
// ainda ficarem visualmente diferentes (a cor vem da marca), e a mesma empresa
// pode escolher entre composições claramente distintas.
//
// Nenhum campo aqui inventa dado sobre a empresa. Cor, fonte e forma são
// decisões de design do produto — nunca afirmação sobre o negócio.

import { resolverFamilia, type FamiliaId, type Tema } from "./families";

export type ModeloId = "aurora" | "vertice" | "pulse";

/** Seções do meio do site — as que o orquestrador sabe montar (as que dependem
 *  de dado real aparecem só quando o dado existe). A ORDEM em que elas entram
 *  é decisão de cada modelo: é o que faz "distribuição" e "ritmo" serem
 *  realmente diferentes entre Aurora, Vértice e Pulse, e não só a cor. */
export type ChaveSecao =
  | "problema" | "sobre" | "diferenciais" | "processo" | "servicos"
  | "galeria" | "equipe" | "depoimentos" | "faq" | "contato";

/** Acento cromático completo — a assinatura do modelo quando a empresa ainda
 *  não tem segmento reconhecido (família universal). Com segmento conhecido, o
 *  acento vem da família (marca do cliente) e só a ESTRUTURA muda. */
export type PaletaAcento = {
  primary: string; primaryDeep: string; primarySoft: string; primaryBorder: string;
  emotional: string; emotionalSoft: string;
  contrast: string; contrastSoft: string;
};

export type NeutrosDoModelo = {
  ink: string; ink2: string; ink3: string;
  paper: string; paper2: string;
  text: string; textMuted: string; textFaint: string;
  textOnPaper: string; textMutedOnPaper: string;
  line: string; lineOnPaper: string;
};

export type Modelo = {
  id: ModeloId;
  nome: string;
  rotulo: string;
  resumo: string;
  indicadoPara: string;
  base: "claro" | "escuro";
  /** Polo com que o RITMO claro/escuro das seções começa (o hero é fixo por
   *  modelo e o fecho — CTA + footer — é sempre escuro). */
  tomInicial: "light" | "dark";
  /** Ordem em que este modelo distribui as seções do meio. O orquestrador
   *  calcula o ritmo claro/escuro NESTA ordem e o shell do modelo renderiza
   *  exatamente nela — ordem e ritmo são a mesma decisão, tomada uma vez só. */
  ordemDasSecoes: ChaveSecao[];
  raio: number;
  fontes: { display: string; corpo: string };
  importacaoDeFontes: string;
  acento: PaletaAcento;
  neutros: NeutrosDoModelo;
};

export const MODELOS: Record<ModeloId, Modelo> = {
  aurora: {
    id: "aurora",
    nome: "Aurora",
    rotulo: "Claro e moderno",
    resumo: "Claro, sofisticado e tecnológico, com gradientes controlados e muito espaço para a imagem.",
    indicadoPara: "Consultórios, fisioterapia, psicologia, serviços, profissionais liberais e empresas modernas.",
    base: "claro",
    tomInicial: "light",
    // Narrativa Aurora: dor do visitante → quem somos → princípios → como
    // funciona → oferta → bloco de contato estruturado → provas visuais e
    // humanas → dúvidas → contato.
    ordemDasSecoes: ["problema", "sobre", "diferenciais", "processo", "servicos", "galeria", "equipe", "depoimentos", "faq", "contato"],
    raio: 20,
    fontes: {
      display: "'Sora', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      corpo: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    importacaoDeFontes:
      "@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');",
    acento: {
      primary: "#5b5bd6", primaryDeep: "#3f3fb3",
      primarySoft: "rgba(91,91,214,.12)", primaryBorder: "rgba(91,91,214,.30)",
      emotional: "#8b5cf6", emotionalSoft: "rgba(139,92,246,.14)",
      contrast: "#3b3fb0", contrastSoft: "rgba(59,63,176,.14)",
    },
    neutros: {
      ink: "#0a0f1f", ink2: "#111830", ink3: "#070b16",
      paper: "#f6f7fc", paper2: "#ffffff",
      text: "#eef1fa", textMuted: "#a9b2cd", textFaint: "#7b86a3",
      textOnPaper: "#0c1226", textMutedOnPaper: "#5a6480",
      line: "rgba(238,241,250,.12)", lineOnPaper: "rgba(12,18,38,.10)",
    },
  },
  vertice: {
    id: "vertice",
    nome: "Vértice",
    rotulo: "Executivo e editorial",
    resumo: "Composição institucional, tipografia editorial, linhas finas e grid preciso — autoridade sem excesso de cards.",
    indicadoPara: "Advocacia, contabilidade, consultoria, engenharia e empresas B2B.",
    base: "claro",
    tomInicial: "light",
    // Narrativa Vértice: apresentação institucional primeiro (quem somos),
    // depois a questão do visitante, os princípios, o método, a oferta — e as
    // provas no fim, como um dossiê.
    ordemDasSecoes: ["sobre", "problema", "diferenciais", "processo", "servicos", "galeria", "equipe", "depoimentos", "faq", "contato"],
    raio: 2,
    fontes: {
      display: "'Playfair Display', 'Iowan Old Style', Georgia, serif",
      corpo: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    importacaoDeFontes:
      "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');",
    acento: {
      primary: "#2f7a67", primaryDeep: "#1d5245",
      primarySoft: "rgba(47,122,103,.12)", primaryBorder: "rgba(47,122,103,.32)",
      emotional: "#1f4f74", emotionalSoft: "rgba(31,79,116,.14)",
      contrast: "#17493f", contrastSoft: "rgba(23,73,63,.16)",
    },
    neutros: {
      ink: "#14181d", ink2: "#1b2127", ink3: "#0d1013",
      paper: "#f4f3ef", paper2: "#fbfaf7",
      text: "#f1f1ef", textMuted: "#a8adb2", textFaint: "#7c8288",
      textOnPaper: "#16191d", textMutedOnPaper: "#5b6167",
      line: "rgba(241,241,239,.12)", lineOnPaper: "rgba(22,25,29,.14)",
    },
  },
  pulse: {
    id: "pulse",
    nome: "Pulse",
    rotulo: "Visual e comercial",
    resumo: "Grandes fotografias, blocos assimétricos, contraste alto e chamada comercial evidente.",
    indicadoPara: "Barbearia, estética, academia, salão, comércio e negócios locais.",
    base: "escuro",
    tomInicial: "dark",
    // Narrativa Pulse: oferta imediatamente depois do hero (intenção comercial),
    // contexto, princípios, provas visuais e sociais, e só então o "como
    // funciona" — o inverso do institucional.
    ordemDasSecoes: ["servicos", "problema", "sobre", "diferenciais", "galeria", "depoimentos", "equipe", "processo", "faq", "contato"],
    raio: 18,
    fontes: {
      display: "'Archivo', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      corpo: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    importacaoDeFontes:
      "@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');",
    acento: {
      primary: "#ff6a1f", primaryDeep: "#d1460a",
      primarySoft: "rgba(255,106,31,.14)", primaryBorder: "rgba(255,106,31,.34)",
      emotional: "#e0245e", emotionalSoft: "rgba(224,36,94,.16)",
      contrast: "#c2410c", contrastSoft: "rgba(194,65,12,.16)",
    },
    neutros: {
      ink: "#141110", ink2: "#1d1917", ink3: "#0b0908",
      paper: "#fdf7f2", paper2: "#ffffff",
      text: "#fdf7f2", textMuted: "#c4b3a6", textFaint: "#8f8074",
      textOnPaper: "#1a1412", textMutedOnPaper: "#6a5b52",
      line: "rgba(253,247,242,.13)", lineOnPaper: "rgba(26,20,18,.12)",
    },
  },
};

export const MODELOS_LISTA: Modelo[] = [MODELOS.aurora, MODELOS.vertice, MODELOS.pulse];

export const MODELO_PADRAO: ModeloId = "aurora";

// Recomendação padrão por segmento já cadastrado — nunca uma escolha forçada:
// é só o ponto de partida para quem ainda não escolheu nada. Nenhum slug
// existente muda de URL nem de dados por causa disto.
export const MODELO_PADRAO_POR_FAMILIA: Record<FamiliaId, ModeloId> = {
  saude: "aurora",
  autoridade: "vertice",
  consumo: "pulse",
  tecnica: "vertice",
  universal: "aurora",
};

export function isModeloId(valor: unknown): valor is ModeloId {
  return valor === "aurora" || valor === "vertice" || valor === "pulse";
}

// ── Seleção do modelo ──────────────────────────────────────────────────────
//
// Precedência (nenhuma etapa inventa dado e nenhuma quebra slug existente):
//   1. `?modelo=` na URL — sempre validado por allowlist (isModeloId). Serve
//      para o cliente pré-visualizar/e comparar os três modelos no site dele
//      sem publicar nada e sem gravar nada no banco;
//   2. recomendação do segmento já cadastrado (MODELO_PADRAO_POR_FAMILIA).
//
// Um valor inválido nunca vira erro nem 404: cai na recomendação do segmento.
export function resolverModelo(especialidade?: string | null, preferido?: string | null): ModeloId {
  if (isModeloId(preferido)) return preferido;
  return MODELO_PADRAO_POR_FAMILIA[resolverFamilia(especialidade).id] ?? MODELO_PADRAO;
}

/** Monta o Tema consumido por TODOS os componentes (compartilhados e por
 *  modelo): neutros, tipografia, raio e polo do modelo + cor da marca da
 *  família. Mantém o formato histórico de Tema (families.ts) para nenhum
 *  componente precisar de um segundo sistema de tokens. */
export function temaDoModelo(modeloId: ModeloId, especialidade?: string | null): Tema {
  const familia = resolverFamilia(especialidade);
  const modelo = MODELOS[modeloId] ?? MODELOS[MODELO_PADRAO];
  // Com segmento reconhecido, a cor é a da marca do cliente (families.ts).
  // Sem segmento, o acento de assinatura do modelo assume — caso contrário
  // todo site sem segmento cairia na mesma cor neutra e os três modelos
  // pareceriam só variações de layout sem identidade cromática.
  const comSegmento = familia.id !== "universal";
  const acento: PaletaAcento = comSegmento
    ? {
        primary: familia.primary, primaryDeep: familia.primaryDeep,
        primarySoft: familia.primarySoft, primaryBorder: familia.primaryBorder,
        emotional: familia.emotional, emotionalSoft: familia.emotionalSoft,
        contrast: familia.contrast, contrastSoft: familia.contrastSoft,
      }
    : modelo.acento;

  return {
    id: familia.id,
    nome: familia.nome,
    fonteDisplay: modelo.fontes.display,
    fonteCorpo: modelo.fontes.corpo,
    modeloId: modelo.id,
    base: modelo.base,
    ...modelo.neutros,
    ...acento,
    radius: modelo.raio,
  };
}
