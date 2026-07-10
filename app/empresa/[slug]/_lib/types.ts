export type Empresa = {
  nome?: string; especialidade?: string; cidade?: string; estado?: string;
  telefone?: string; email?: string; endereco?: string; whatsapp?: string;
  google_maps_url?: string; logo_url?: string; hero_url?: string;
  nota_google?: number | null; num_avaliacoes?: number | null;
  horario_funcionamento?: string | null;
};

export type DBGaleria    = { id: string; url: string; categoria: string; titulo: string | null; ordem: number };
export type DBEquipe     = { id: string; foto_url: string | null; nome: string; especialidade: string | null; cro: string | null; descricao: string | null; ordem: number };
export type DBAntes      = { id: string; antes_url: string | null; depois_url: string | null; titulo: string; descricao: string | null; ordem: number };
export type DBDepoimento = { id: string; nome: string; cidade: string | null; comentario: string; nota: number; foto_url: string | null; ordem: number };
export type DBServico    = { id: string; icone: string; imagem_url: string | null; nome: string; descricao: string | null; ordem: number };
export type DBEstrutura  = { id: string; imagem_url: string; titulo: string; descricao: string | null; categoria: string; ordem: number };

export type SiteData = {
  empresa: Empresa;
  galeria: DBGaleria[];
  equipe: DBEquipe[];
  antesDepois: DBAntes[];
  depoimentos: DBDepoimento[];
  servicos: DBServico[];
  estrutura: DBEstrutura[];
};
