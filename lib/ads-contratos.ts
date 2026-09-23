// Contratos internos. Nenhum SDK, token, OAuth ou envio para plataformas.
export type PlataformaAds = 'google_ads' | 'meta_ads';
export type ConexaoAds = {
  plataforma: PlataformaAds;
  estado: 'nao_configurada' | 'pendente_homologacao' | 'conectada' | 'revogada';
  contaExternaId: string | null;
  credencialServidorRef: string | null; // referência opaca, nunca o segredo
};
export type IdentificadoresAds = {
  campaign_id: string | null; ad_id: string | null; adset_id: string | null;
  gbraid: string | null; wbraid: string | null;
};
export function capturarIdentificadoresAds(params: URLSearchParams): IdentificadoresAds {
  const ler = (key: string) => params.get(key)?.trim().slice(0, 200) || null;
  return { campaign_id: ler('campaign_id') || ler('utm_id'), ad_id: ler('ad_id'), adset_id: ler('adset_id'), gbraid: ler('gbraid'), wbraid: ler('wbraid') };
}
export type ConversaoAdsPreparada = {
  chaveIdempotencia: string; plataforma: PlataformaAds; origemId: string;
  pagamentoTipo: 'pedido' | 'cobranca'; pagamentoId: string;
  valorCentavos: number; moeda: 'BRL'; ocorridoEm: string;
};
export interface AdaptadorAdsOficial {
  // Implementação futura deve resolver credencial no servidor, verificar
  // consentimento/políticas e mapear este contrato à versão oficial da API.
  enviarConversao(conexao: ConexaoAds, conversao: ConversaoAdsPreparada): Promise<{ idExterno: string }>;
}
export const CONEXOES_ADS_V1: ReadonlyArray<Pick<ConexaoAds, 'plataforma' | 'estado' | 'contaExternaId'>> = [
  { plataforma: 'google_ads', estado: 'nao_configurada', contaExternaId: null },
  { plataforma: 'meta_ads', estado: 'nao_configurada', contaExternaId: null },
];
