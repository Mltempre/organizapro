export const UNIDADES_PESQUISA = [
  "un",
  "g",
  "kg",
  "ml",
  "l",
  "cm",
  "m",
  "caixa",
  "pacote",
] as const;

export type UnidadePesquisa = (typeof UNIDADES_PESQUISA)[number];

export const TIPOS_FONTE_PRECO = [
  "manual",
  "documento",
  "cotacao",
  "url_verificada",
  "importacao",
  "api_autorizada",
] as const;

export type TipoFontePreco = (typeof TIPOS_FONTE_PRECO)[number];

type DefinicaoUnidade = { dimensao: string; fatorParaBase: number };

const UNIDADES: Record<UnidadePesquisa, DefinicaoUnidade> = {
  un: { dimensao: "unidade", fatorParaBase: 1 },
  g: { dimensao: "massa", fatorParaBase: 1 },
  kg: { dimensao: "massa", fatorParaBase: 1000 },
  ml: { dimensao: "volume", fatorParaBase: 1 },
  l: { dimensao: "volume", fatorParaBase: 1000 },
  cm: { dimensao: "comprimento", fatorParaBase: 1 },
  m: { dimensao: "comprimento", fatorParaBase: 100 },
  caixa: { dimensao: "caixa", fatorParaBase: 1 },
  pacote: { dimensao: "pacote", fatorParaBase: 1 },
};

export type MotivoNaoComparavel =
  | "preco_invalido"
  | "quantidade_invalida"
  | "unidade_nao_suportada"
  | "unidade_incompativel"
  | "moeda_incompativel";

export type ResultadoNormalizacao =
  | {
      comparavel: true;
      precoNormalizadoCentavos: number;
      unidadeCanonica: UnidadePesquisa;
    }
  | {
      comparavel: false;
      precoNormalizadoCentavos: null;
      unidadeCanonica: UnidadePesquisa;
      motivo: MotivoNaoComparavel;
    };

export function unidadePesquisaValida(valor: unknown): valor is UnidadePesquisa {
  return typeof valor === "string" && (UNIDADES_PESQUISA as readonly string[]).includes(valor);
}

export function tipoFontePrecoValido(valor: unknown): valor is TipoFontePreco {
  return typeof valor === "string" && (TIPOS_FONTE_PRECO as readonly string[]).includes(valor);
}

export function normalizarPrecoObservado(input: {
  precoCentavos: number;
  quantidade: number;
  unidadeObservada: string;
  unidadeCanonica: UnidadePesquisa;
  moeda?: string;
  moedaComparacao?: string;
}): ResultadoNormalizacao {
  const moeda = input.moeda ?? "BRL";
  const moedaComparacao = input.moedaComparacao ?? "BRL";
  if (!Number.isInteger(input.precoCentavos) || input.precoCentavos <= 0) {
    return { comparavel: false, precoNormalizadoCentavos: null, unidadeCanonica: input.unidadeCanonica, motivo: "preco_invalido" };
  }
  if (!Number.isFinite(input.quantidade) || input.quantidade <= 0) {
    return { comparavel: false, precoNormalizadoCentavos: null, unidadeCanonica: input.unidadeCanonica, motivo: "quantidade_invalida" };
  }
  if (!unidadePesquisaValida(input.unidadeObservada)) {
    return { comparavel: false, precoNormalizadoCentavos: null, unidadeCanonica: input.unidadeCanonica, motivo: "unidade_nao_suportada" };
  }
  if (moeda !== moedaComparacao) {
    return { comparavel: false, precoNormalizadoCentavos: null, unidadeCanonica: input.unidadeCanonica, motivo: "moeda_incompativel" };
  }

  const observada = UNIDADES[input.unidadeObservada];
  const canonica = UNIDADES[input.unidadeCanonica];
  if (observada.dimensao !== canonica.dimensao) {
    return { comparavel: false, precoNormalizadoCentavos: null, unidadeCanonica: input.unidadeCanonica, motivo: "unidade_incompativel" };
  }

  const quantidadeNaBase = input.quantidade * observada.fatorParaBase;
  const quantidadeCanonica = quantidadeNaBase / canonica.fatorParaBase;
  const precoNormalizadoCentavos = input.precoCentavos / quantidadeCanonica;
  if (!Number.isFinite(precoNormalizadoCentavos) || precoNormalizadoCentavos <= 0) {
    return { comparavel: false, precoNormalizadoCentavos: null, unidadeCanonica: input.unidadeCanonica, motivo: "quantidade_invalida" };
  }

  return { comparavel: true, precoNormalizadoCentavos, unidadeCanonica: input.unidadeCanonica };
}

export type ObservacaoParaComparacao = {
  id: string;
  fonteId: string;
  fonteNome: string;
  precoCentavos: number;
  quantidade: number;
  unidadeObservada: string;
  unidadeCanonica: UnidadePesquisa;
  moeda: string;
  observadoEm: string;
};

export type LinhaComparavel = ObservacaoParaComparacao & {
  precoNormalizadoCentavos: number;
  antigo: boolean;
};

export type EstadoComparacao =
  | "sem_observacoes"
  | "sem_observacoes_comparaveis"
  | "dados_antigos"
  | "fonte_insuficiente"
  | "comparacao_disponivel";

export type ComparacaoPrecos = {
  estado: EstadoComparacao;
  comparaveis: LinhaComparavel[];
  naoComparaveis: Array<{ id: string; motivo: MotivoNaoComparavel }>;
  fontesDistintas: number;
};

export function compararObservacoes(
  observacoes: ObservacaoParaComparacao[],
  agora = new Date().toISOString(),
  maximoDias = 30
): ComparacaoPrecos {
  if (observacoes.length === 0) {
    return { estado: "sem_observacoes", comparaveis: [], naoComparaveis: [], fontesDistintas: 0 };
  }

  const agoraMs = new Date(agora).getTime();
  const limiteMs = maximoDias * 24 * 60 * 60 * 1000;
  const comparaveis: LinhaComparavel[] = [];
  const naoComparaveis: Array<{ id: string; motivo: MotivoNaoComparavel }> = [];

  for (const observacao of observacoes) {
    const normalizada = normalizarPrecoObservado({
      precoCentavos: observacao.precoCentavos,
      quantidade: observacao.quantidade,
      unidadeObservada: observacao.unidadeObservada,
      unidadeCanonica: observacao.unidadeCanonica,
      moeda: observacao.moeda,
    });
    if (normalizada.comparavel === false) {
      naoComparaveis.push({ id: observacao.id, motivo: normalizada.motivo });
      continue;
    }
    const observadoMs = new Date(observacao.observadoEm).getTime();
    const antigo = !Number.isFinite(observadoMs) || agoraMs - observadoMs > limiteMs;
    comparaveis.push({ ...observacao, precoNormalizadoCentavos: normalizada.precoNormalizadoCentavos, antigo });
  }

  if (comparaveis.length === 0) {
    return { estado: "sem_observacoes_comparaveis", comparaveis, naoComparaveis, fontesDistintas: 0 };
  }

  const atuais = comparaveis.filter((linha) => !linha.antigo);
  if (atuais.length === 0) {
    return { estado: "dados_antigos", comparaveis, naoComparaveis, fontesDistintas: new Set(comparaveis.map((o) => o.fonteId)).size };
  }

  atuais.sort((a, b) => a.precoNormalizadoCentavos - b.precoNormalizadoCentavos);
  const fontesDistintas = new Set(atuais.map((o) => o.fonteId)).size;
  return {
    estado: fontesDistintas < 2 ? "fonte_insuficiente" : "comparacao_disponivel",
    comparaveis: [...atuais, ...comparaveis.filter((linha) => linha.antigo)],
    naoComparaveis,
    fontesDistintas,
  };
}
