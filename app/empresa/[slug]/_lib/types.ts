export type Empresa = {
  nome?: string; especialidade?: string; cidade?: string; estado?: string;
  telefone?: string; email?: string; endereco?: string; whatsapp?: string;
  google_maps_url?: string; logo_url?: string; hero_url?: string;
  nota_google?: number | null; num_avaliacoes?: number | null;
  horario_funcionamento?: string | null;
  banner_url?: string | null;
  instagram_url?: string | null; facebook_url?: string | null;
  linkedin_url?: string | null; tiktok_url?: string | null;
  seo_titulo?: string | null; seo_descricao?: string | null; seo_imagem_url?: string | null;
};

export type DBGaleria    = { id: string; url: string; categoria: string; titulo: string | null; ordem: number };
export type DBEquipe     = { id: string; foto_url: string | null; nome: string; especialidade: string | null; cro: string | null; descricao: string | null; ordem: number };
export type DBAntes      = { id: string; antes_url: string | null; depois_url: string | null; titulo: string; descricao: string | null; ordem: number };
export type DBDepoimento = { id: string; nome: string; cidade: string | null; comentario: string; nota: number; foto_url: string | null; ordem: number };
export type DBServico    = { id: string; icone: string; imagem_url: string | null; nome: string; descricao: string | null; ordem: number };
export type DBEstrutura  = { id: string; imagem_url: string; titulo: string; descricao: string | null; categoria: string; ordem: number };
// Ainda sem tabela no banco (clinica_faq) — ver supabase/migrations/20260713000001_site_premium_6_faq_redes_seo.sql.
// Tipo já definido para a seção FAQ passar a consumir dado real assim que a migração for aplicada.
export type DBFaq        = { id: string; pergunta: string; resposta: string; ordem: number };

export type SiteData = {
  empresa: Empresa;
  galeria: DBGaleria[];
  equipe: DBEquipe[];
  antesDepois: DBAntes[];
  depoimentos: DBDepoimento[];
  servicos: DBServico[];
  estrutura: DBEstrutura[];
};
