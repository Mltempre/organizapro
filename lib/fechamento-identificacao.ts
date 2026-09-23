// ── Contador IA · Identificação Inteligente V1 ───────────────────────────
// Classifica um arquivo recebido — SEM OCR, SEM visão computacional, SEM
// IA generativa: nenhuma dessas infraestruturas existe hoje no OrganizaPro
// (auditado) e fingir reconhecimento de conteúdo sem elas violaria o
// Princípio da Transparência do produto (nunca fabricar confiança sobre
// dado que não foi de fato examinado).
//
// A única evidência real disponível sem infraestrutura nova é o NOME do
// arquivo — texto que o próprio remetente escolheu, examinado de forma
// determinística (normalização + correspondência exata/sinônimo contra os
// tipos JÁ CONFIGURADOS pela clínica, nunca um tipo inventado). Isso é
// pouco, e o motor é honesto sobre isso: qualquer ambiguidade, qualquer
// tipo não reconhecido, ou qualquer divergência de competência detectada
// no nome do arquivo vira REVISÃO NECESSÁRIA — nunca uma baixa automática
// arriscada. Este arquivo documenta explicitamente o ponto de extensão
// para quando (fora desta missão) existir OCR/visão real: a mesma função
// `classificarArquivo` pode receber sinais adicionais (texto extraído,
// classificação de imagem) via os campos opcionais de `EvidenciaArquivo`
// sem mudar o contrato de saída.

export type ConfiancaClassificacao = "alta" | "media" | "baixa";

export type EvidenciaArquivo = {
  nomeArquivo: string;
  competenciaAlvo: string; // competência do contexto de upload (AAAA-MM) — nunca inferida do nada
  // Ponto de extensão futuro (não implementado nesta V1): texto extraído
  // por OCR real, se um dia existir infraestrutura para isso.
  textoExtraido?: string | null;
};

export type ClassificacaoArquivo = {
  tipoDocumentoSugerido: string | null; // sempre um dos tiposConhecidos, nunca inventado
  competenciaDetectada: string | null; // AAAA-MM encontrado no nome, se houver
  confianca: ConfiancaClassificacao;
  necessitaRevisao: boolean;
  motivo: string; // explicação curta e honesta, nunca "IA analisou e confirmou"
};

function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .trim();
}

// Sinônimos curtos e conservadores — só amplia o casamento de um tipo JÁ
// configurado pela clínica; nunca introduz um tipo novo por conta própria.
const SINONIMOS: Record<string, string[]> = {
  "extrato bancario": ["extrato", "ofx", "extratobancario"],
  "notas fiscais": ["nota fiscal", "nf", "nfe", "nfse", "notafiscal"],
  "folha": ["folha de pagamento", "holerite", "folhapagamento"],
  "comprovantes": ["comprovante", "recibo"],
};

const MESES: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};

/** Procura AAAA-MM em qualquer formato comum de nome de arquivo:
 * 2026-09, 2026_09, 09-2026, 09_2026, ou "set-2026"/"setembro2026". Nunca
 * inventa uma competência quando o nome não traz nenhuma — retorna null. */
function detectarCompetenciaNoNome(nomeNormalizado: string): string | null {
  const isoOuUnderscore = nomeNormalizado.match(/(20\d{2})[ _-]?(0[1-9]|1[0-2])\b/);
  if (isoOuUnderscore) return `${isoOuUnderscore[1]}-${isoOuUnderscore[2]}`;

  const mesAno = nomeNormalizado.match(/(0[1-9]|1[0-2])[ _-](20\d{2})\b/);
  if (mesAno) return `${mesAno[2]}-${mesAno[1]}`;

  for (const [abrev, numero] of Object.entries(MESES)) {
    const porNome = nomeNormalizado.match(new RegExp(`${abrev}[a-z]*[ _-]?(20\\d{2})`));
    if (porNome) return `${porNome[1]}-${numero}`;
  }
  return null;
}

/** Encontra, entre os tipos JÁ configurados, aquele(s) cujo nome (ou um
 * sinônimo curto) aparece no nome do arquivo. Nunca retorna um tipo que
 * não esteja em `tiposConhecidos` — essa é a garantia central contra
 * "fingir reconhecimento". */
function candidatosDeTipo(nomeNormalizado: string, tiposConhecidos: string[]): string[] {
  const candidatos: string[] = [];
  for (const tipo of tiposConhecidos) {
    const tipoNorm = normalizar(tipo);
    const alvos = [tipoNorm, ...(SINONIMOS[tipoNorm] ?? [])];
    if (alvos.some((alvo) => nomeNormalizado.includes(alvo))) candidatos.push(tipo);
  }
  return candidatos;
}

/**
 * Classifica um arquivo recebido. Regras de confiança, sempre explicáveis:
 * - Nenhum tipo conhecido reconhecido no nome -> revisão (baixa confiança).
 * - Mais de um tipo candidato (ambíguo) -> revisão (baixa confiança) —
 *   nunca escolhe "o primeiro" arbitrariamente.
 * - Um tipo único reconhecido, e o nome NÃO traz nenhuma competência, ou
 *   traz e ela BATE com a competência alvo do upload -> alta confiança.
 * - Um tipo único reconhecido, mas o nome traz uma competência DIFERENTE
 *   da competência alvo -> revisão (confiança média) — proteção explícita
 *   contra dar baixa num documento do mês errado.
 */
export function classificarArquivo(
  evidencia: EvidenciaArquivo,
  tiposConhecidos: string[]
): ClassificacaoArquivo {
  const nomeNormalizado = normalizar(evidencia.nomeArquivo);
  const competenciaDetectada = detectarCompetenciaNoNome(nomeNormalizado);
  const candidatos = candidatosDeTipo(nomeNormalizado, tiposConhecidos);

  if (candidatos.length === 0) {
    return {
      tipoDocumentoSugerido: null, competenciaDetectada, confianca: "baixa", necessitaRevisao: true,
      motivo: "Nenhum tipo de documento configurado foi reconhecido no nome do arquivo.",
    };
  }
  if (candidatos.length > 1) {
    return {
      tipoDocumentoSugerido: null, competenciaDetectada, confianca: "baixa", necessitaRevisao: true,
      motivo: `Nome do arquivo é ambíguo entre ${candidatos.length} tipos possíveis: ${candidatos.join(", ")}.`,
    };
  }

  const tipo = candidatos[0];
  if (competenciaDetectada && competenciaDetectada !== evidencia.competenciaAlvo) {
    return {
      tipoDocumentoSugerido: tipo, competenciaDetectada, confianca: "media", necessitaRevisao: true,
      motivo: `Nome do arquivo indica competência ${competenciaDetectada}, diferente da competência alvo (${evidencia.competenciaAlvo}).`,
    };
  }

  return {
    tipoDocumentoSugerido: tipo, competenciaDetectada, confianca: "alta", necessitaRevisao: false,
    motivo: `Nome do arquivo reconhece "${tipo}" com segurança suficiente.`,
  };
}
