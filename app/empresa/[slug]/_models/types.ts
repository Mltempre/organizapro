import type { ReactNode } from "react";
import type { Tema, Tone } from "../_lib/families";
import type { ModeloId } from "../_lib/modelos";
import type { Empresa, DBGaleria, DBEstrutura, DBAntes, DBEquipe, DBDepoimento, DBServico, DBFaq } from "../_lib/types";
import type { SiteNavItem } from "../_components/Header";

// ── Contrato comum dos três modelos ───────────────────────────────────────
//
// Todos os modelos recebem EXATAMENTE o mesmo objeto: os dados reais já
// resolvidos pelo orquestrador (SiteEmpresaClient), o tema do modelo
// (_lib/modelos.ts) e as decisões que o orquestrador já toma hoje (ritmo
// claro/escuro das seções, itens de navegação que existem de verdade e os
// links de WhatsApp com código de rastreio). Nenhum modelo consulta banco,
// nenhum modelo inventa dado e nenhum modelo pode produzir uma âncora órfã —
// a navegação chega pronta, só com seções que vão aparecer.
export type PropsDoSite = {
  slug: string;
  codigoRastreio?: string;
  modelo: ModeloId;
  tema: Tema;
  empresa: Empresa;
  nome: string;
  esp: string;
  local: string;
  sobre: string[];
  titulo: string;
  subtitulo: string;
  navItems: SiteNavItem[];
  tons: Record<string, { tone: Tone; variant: 1 | 2 } | undefined>;
  waHero: string;
  waContato: string;
  waFinal: string;
  waBase?: string;
  whatsappNumber?: string;
  mediaHero?: string | null;
  ctaMsgs: { hero: string; problema: string; servicos: string; final: string };
  servicos: DBServico[];
  galeria: DBGaleria[];
  estrutura: DBEstrutura[];
  antesDepois: DBAntes[];
  equipe: DBEquipe[];
  depoimentos: DBDepoimento[];
  faqs: DBFaq[];
  temGaleria: boolean;
  temContato: boolean;
  /** <PedidoPublico/> + <InteressePublico/> montados pelo orquestrador (mesmo
   *  par, mesma ordem, sem nenhuma alteração de contrato de dados). Entra onde
   *  o modelo decidir posicionar os blocos de contato estruturado. */
  blocoPublico?: ReactNode;
};
