// ── IA Universal · Tipos compartilhados ─────────────────────────────────────
//
// Ver docs/ia-universal-organizapro-v1-arquitetura.md para o desenho completo.
// Fase 1 (esta): só Camada 1 (núcleo universal) + Camada 2 (módulos de
// segmento) existem de fato. Camada 3 aqui é um adaptador mínimo do que já é
// buscado hoje em app/api/chatbot/message/route.ts (chatbot_config +
// clinicas.especialidade) — nenhuma tabela nova, nenhuma migração. Camada 4
// não existe nesta fase.

export type IntencaoUniversal =
  | "saudacao"
  | "despedida"
  | "horario_funcionamento"
  | "endereco_localizacao"
  | "agendar"
  | "reagendar_cancelar"
  | "confirmar_presenca"
  | "duvida_preco_generica"
  | "falar_com_humano"
  | "elogio_reclamacao"
  | "fora_do_escopo"
  | "intencao_especifica_segmento";

// Dados da empresa autenticada — nunca de outro tenant. Adaptador mínimo
// desta fase: só os campos que já existem hoje em `clinica_config` +
// `clinicas.especialidade`. Nenhum campo novo, nenhuma tabela nova.
export type DadosEmpresaUniversal = {
  nome:        string;
  segmento:    string;        // clinicas.especialidade (texto livre)
  horario?:    string | null;
  endereco?:   string | null;
  linkHumano?: string | null;
};

export type SinalSegmento = {
  id:              string;
  exemplosDeFrase: string[];  // só documentação/curadoria — o matching real usa vocabularioReconhecido
  // Resolve a resposta usando só DadosEmpresaUniversal — nunca inventa.
  // Retorna null quando o dado necessário não existe (o chamador decide o
  // que fazer: cair no sistema atual, ou pedir esclarecimento).
  resolver:        (dados: DadosEmpresaUniversal) => string | null;
};

export type ModuloSegmento = {
  chave:                  string;   // "barbearia", "oficina", "generico", ...
  nomesAlternativos:      string[]; // usados para mapear especialidade (texto livre) → chave
  vocabularioReconhecido: string[]; // termos que, se a mensagem contiver, viram "intencao_especifica_segmento"
  intencoesAdicionais:    SinalSegmento[];
};

export type ResultadoCamadaUniversal = {
  intencao: IntencaoUniversal;
  resposta: string;
  modulo?:  string; // chave do módulo de segmento, quando quem respondeu foi a Camada 2
};
