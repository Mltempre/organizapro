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
import type { ModuloSegmento } from "./tipos";

const MODULO_GENERICO: ModuloSegmento = {
  chave: "generico",
  nomesAlternativos: [],
  vocabularioReconhecido: [],
  intencoesAdicionais: [],
};

const MODULOS: ModuloSegmento[] = [
  {
    chave: "advogados",
    nomesAlternativos: ["advocacia", "advogado", "advogados", "escritorio de advocacia"],
    vocabularioReconhecido: ["consulta juridica", "processo", "area de atuacao", "honorarios"],
    intencoesAdicionais: [
      {
        id: "areas_atuacao",
        exemplosDeFrase: ["area de atuacao", "quais areas", "que tipo de caso"],
        resolver: () => null, // sem dado estruturado de "áreas de atuação" nesta fase — sinaliza lacuna, não inventa
      },
    ],
  },
  {
    chave: "barbearia",
    nomesAlternativos: ["barbearia", "barber", "barbeiro"],
    vocabularioReconhecido: ["corte", "barba", "cabelo", "degrade"],
    intencoesAdicionais: [
      {
        id: "corte_infantil",
        exemplosDeFrase: ["corte infantil", "corta cabelo de crianca", "atende crianca"],
        resolver: () => null,
      },
    ],
  },
  {
    chave: "oficina",
    nomesAlternativos: ["oficina", "oficina mecanica", "mecanica", "auto center"],
    vocabularioReconhecido: ["alinhamento", "revisao", "troca de oleo", "seguradora"],
    intencoesAdicionais: [
      {
        id: "atende_seguradora",
        exemplosDeFrase: ["atende seguradora", "trabalha com seguro"],
        resolver: () => null,
      },
    ],
  },
  {
    chave: "restaurante",
    nomesAlternativos: ["restaurante", "lanchonete", "pizzaria", "hamburgueria"],
    vocabularioReconhecido: ["cardapio", "delivery", "vegetariano", "vegano", "reserva de mesa"],
    intencoesAdicionais: [
      {
        id: "opcao_vegetariana",
        exemplosDeFrase: ["opcao vegetariana", "tem prato vegano", "cardapio vegetariano"],
        resolver: () => null,
      },
    ],
  },
  {
    chave: "clinica",
    nomesAlternativos: ["clinica", "consultorio", "clinica medica", "clinica odontologica"],
    vocabularioReconhecido: ["convenio", "procedimento", "exame", "especialidade medica"],
    intencoesAdicionais: [
      {
        id: "atende_convenio",
        exemplosDeFrase: ["atende convenio", "aceita convenio", "atende plano de saude"],
        resolver: () => null,
      },
    ],
  },
  {
    chave: "pet_shop",
    nomesAlternativos: ["pet shop", "petshop", "pet"],
    vocabularioReconhecido: ["banho e tosa", "vacina", "emergencia veterinaria"],
    intencoesAdicionais: [
      {
        id: "banho_tosa",
        exemplosDeFrase: ["banho e tosa", "fazem tosa", "fazem banho"],
        resolver: () => null,
      },
    ],
  },
  {
    chave: "academia",
    nomesAlternativos: ["academia", "estudio de treino", "box de crossfit", "crossfit"],
    vocabularioReconhecido: ["aula experimental", "musculacao", "personal", "matricula"],
    intencoesAdicionais: [
      {
        id: "aula_experimental",
        exemplosDeFrase: ["aula experimental", "aula gratis", "aula teste"],
        resolver: () => null,
      },
    ],
  },
  {
    chave: "imobiliaria",
    nomesAlternativos: ["imobiliaria", "corretora de imoveis", "corretor de imoveis"],
    vocabularioReconhecido: ["imovel", "aluguel", "avaliacao de imovel", "visita ao imovel"],
    intencoesAdicionais: [
      {
        id: "avaliacao_imovel",
        exemplosDeFrase: ["fazem avaliacao", "avaliar meu imovel"],
        resolver: () => null,
      },
    ],
  },
  {
    chave: "contador",
    nomesAlternativos: ["contabilidade", "contador", "escritorio contabil"],
    vocabularioReconhecido: ["mei", "declaracao de ir", "abertura de empresa", "imposto de renda"],
    intencoesAdicionais: [
      {
        id: "abertura_mei",
        exemplosDeFrase: ["abrem mei", "abertura de mei", "abrir empresa"],
        resolver: () => null,
      },
    ],
  },
  {
    chave: "estetica",
    nomesAlternativos: ["estetica", "clinica de estetica", "studio de estetica"],
    vocabularioReconhecido: ["limpeza de pele", "botox", "preenchimento", "peeling"],
    intencoesAdicionais: [
      {
        id: "limpeza_pele",
        exemplosDeFrase: ["limpeza de pele", "fazem limpeza de pele"],
        resolver: () => null,
      },
    ],
  },
  {
    chave: "fisioterapia",
    nomesAlternativos: ["fisioterapia", "clinica de fisioterapia", "fisioterapeuta"],
    vocabularioReconhecido: ["rpg", "encaminhamento medico", "sessao de fisioterapia"],
    intencoesAdicionais: [
      {
        id: "precisa_encaminhamento",
        exemplosDeFrase: ["precisa de encaminhamento", "precisa de pedido medico"],
        resolver: () => null,
      },
    ],
  },
  {
    chave: "psicologia",
    nomesAlternativos: ["psicologia", "clinica de psicologia", "psicologo", "psicologa"],
    vocabularioReconhecido: ["atendimento online", "abordagem terapeutica", "terapia"],
    intencoesAdicionais: [
      {
        id: "atende_online",
        exemplosDeFrase: ["atende online", "sessao online", "terapia online"],
        resolver: () => null,
      },
    ],
  },
  {
    chave: "veterinaria",
    nomesAlternativos: ["veterinaria", "clinica veterinaria", "veterinario"],
    vocabularioReconhecido: ["emergencia 24h", "vacinacao", "castracao"],
    intencoesAdicionais: [
      {
        id: "emergencia_24h",
        exemplosDeFrase: ["emergencia 24h", "atende emergencia", "plantao 24 horas"],
        resolver: () => null,
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
  for (const modulo of MODULOS) {
    if (modulo.nomesAlternativos.some(nome => alvo.includes(normalizarUniversal(nome)))) return modulo;
  }
  return MODULO_GENERICO;
}

export const MODULOS_SEGMENTO_DISPONIVEIS = MODULOS;
export { MODULO_GENERICO };
