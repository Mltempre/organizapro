// ── IA Universal · ponto de entrada público (Fase 1) ────────────────────────
// Ver docs/ia-universal-organizapro-v1-arquitetura.md.

export type {
  IntencaoUniversal,
  DadosEmpresaUniversal,
  SinalSegmento,
  ModuloSegmento,
  ResultadoCamadaUniversal,
} from "./tipos";

export {
  classificarIntencaoUniversal,
  montarRespostaUniversal,
  respeitaRegrasDeSeguranca,
  resolverComCamadaUniversal,
  normalizarUniversal,
} from "./camada1-universal";

export {
  resolverModuloSegmento,
  MODULOS_SEGMENTO_DISPONIVEIS,
  MODULO_GENERICO,
} from "./modulos-segmento";
