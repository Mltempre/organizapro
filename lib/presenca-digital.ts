// ── Presença Digital · diagnóstico honesto, sem API do Google ───────────────
// Ver docs/google-presenca-reputacao-ads-v1-arquitetura.md, Fase 4. Código
// puro sobre os campos que já existem em `clinica_config` hoje (auditoria
// confirmou: nenhuma tabela/coluna nova é necessária para este diagnóstico
// — só leitura do que o próprio dono do negócio já preenche em
// app/configuracoes e app/site).
//
// Por que isto NUNCA pode alegar "integração Google Business Profile":
// `notaGoogle`/`numAvaliacoes` são campos de texto livre digitados pelo
// dono do negócio (app/site/page.tsx) — nunca lidos de nenhuma API do
// Google. Este módulo mede COMPLETUDE DE CADASTRO, não performance real no
// Google. `integracaoGoogleAtiva` é sempre `false` nesta fase — vira `true`
// só no dia em que existir OAuth + chamada real à Google Business Profile
// API (gate externo, não implementado nesta sessão — ver seção 4.2 do
// documento de arquitetura).

export type ConfigPresenca = {
  slug:                  string | null;
  linkGoogle:            string | null;
  notaGoogle:            number | null;
  numAvaliacoes:         number | null;
  telefone:              string | null;
  endereco:              string | null;
  horarioFuncionamento:  string | null;
  seoTitulo:             string | null;
  seoDescricao:          string | null;
};

export type ItemPresenca = {
  chave:     string;
  label:     string;
  completo:  boolean;
};

export type DiagnosticoPresenca = {
  pontuacao:            number; // 0–100, arredondado
  itens:                ItemPresenca[];
  integracaoGoogleAtiva: false; // literal — nunca lido de config, nunca true nesta fase
  observacaoIntegracao:  string;
};

const OBSERVACAO_SEM_INTEGRACAO =
  "Nenhuma API ou credencial do Google Business Profile está integrada " +
  "neste produto. Nota e quantidade de avaliações são digitadas " +
  "manualmente pelo dono do negócio — não são lidas do Google.";

/**
 * Pontuação de completude de cadastro (0–100). Cada item pesa igual —
 * deliberadamente simples: este é um checklist de cadastro, não um score
 * de reputação real (esse dependeria da API do Google, que não existe
 * aqui). `itens.length` nunca é 0 (lista fixa), então a divisão é segura.
 */
export function calcularPresencaDigital(config: ConfigPresenca): DiagnosticoPresenca {
  const itens: ItemPresenca[] = [
    { chave: "site_publicado",  label: "Site público publicado (slug definido)",        completo: !!config.slug },
    { chave: "link_avaliacao",  label: "Link de avaliação do Google cadastrado",        completo: !!config.linkGoogle },
    { chave: "nota_google",     label: "Nota do Google informada",                       completo: config.notaGoogle !== null },
    { chave: "num_avaliacoes",  label: "Quantidade de avaliações informada",             completo: config.numAvaliacoes !== null },
    { chave: "telefone",        label: "Telefone de contato cadastrado",                 completo: !!config.telefone },
    { chave: "endereco",        label: "Endereço cadastrado",                            completo: !!config.endereco },
    { chave: "horario",         label: "Horário de funcionamento cadastrado",            completo: !!config.horarioFuncionamento },
    { chave: "seo",             label: "Título e descrição de SEO preenchidos",          completo: !!config.seoTitulo && !!config.seoDescricao },
  ];

  const completos = itens.filter(i => i.completo).length;
  const pontuacao = Math.round((completos / itens.length) * 100);

  return {
    pontuacao,
    itens,
    integracaoGoogleAtiva: false,
    observacaoIntegracao: OBSERVACAO_SEM_INTEGRACAO,
  };
}
