import type { Empresa } from "./types";

export const initials = (nome: string) =>
  nome.trim().split(" ").filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 2).join("");

export const safeData = <T,>(res: { data: T[] | null; error: { code?: string } | null }) =>
  res.error ? [] : (res.data ?? []);

// ── Copy gerada a partir de dados reais ─────────────────────────────────
//
// Regra de ouro de todo este arquivo: nunca inventar um fato sobre a
// empresa (nenhuma estatística, nenhum elogio não verificável do tipo
// "referência na região"). Cada frase só existe se o campo correspondente
// existir no cadastro; quando falta dado, cai num fallback honesto — nunca
// um fallback que soe como afirmação específica.
//
// Cuidado gramatical deliberado: nomes de empresa em português exigem
// concordância de gênero (a/o, localizada/localizado) que não dá para
// inferir de uma string arbitrária. Por isso as frases abaixo evitam
// artigo + adjetivo flexionado junto ao nome — usam verbos e preposições,
// que não flexionam por gênero.

function tituloCase(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

// O schema legado de clinicas usa "odontologia" como default. Esse valor
// não representa uma escolha do cliente em contas universais recém-criadas.
// Segmentos realmente informados continuam sendo exibidos normalmente.
export function normalizarEspecialidade(especialidade?: string | null): string {
  const valor = especialidade?.trim() ?? "";
  return valor.toLocaleLowerCase("pt-BR") === "odontologia" ? "" : valor;
}

// Texto "Sobre a empresa" — parágrafos curtos, nunca um bloco genérico.
export function gerarSobre(empresa: Empresa, qtdEquipe: number): string[] {
  const blocos: string[] = [];
  const local = [empresa.cidade, empresa.estado].filter(Boolean).join(", ");
  const esp = normalizarEspecialidade(empresa.especialidade).toLowerCase();

  if (esp && local) {
    blocos.push(`${empresa.nome} atua em ${esp}, em ${local}.`);
  } else if (esp) {
    blocos.push(`${empresa.nome} atua em ${esp}.`);
  } else if (local) {
    blocos.push(`${empresa.nome} está em ${local}.`);
  } else {
    blocos.push(`${empresa.nome} valoriza um atendimento próximo, do primeiro contato ao resultado final.`);
  }

  const segundo: string[] = [];
  if (qtdEquipe > 0) {
    segundo.push(`Uma equipe de ${qtdEquipe} ${qtdEquipe > 1 ? "profissionais dedicados" : "profissional dedicado"} cuida de cada atendimento pessoalmente.`);
  }
  segundo.push("Organização e transparência guiam cada etapa, sem letras miúdas.");
  blocos.push(segundo.join(" "));
  return blocos;
}

// Hero — headline muda de fato conforme o dado real disponível, em vez de
// uma frase institucional fixa repetida em todo site publicado.
export function gerarTituloHero(empresa: Empresa): string {
  const especialidade = normalizarEspecialidade(empresa.especialidade);
  if (especialidade) return `${tituloCase(especialidade)}, sem complicação.`;
  if (empresa.nome) return `Conheça ${empresa.nome}.`;
  return "Soluções desenvolvidas para você.";
}

export function gerarSubtituloHero(empresa: Empresa, local: string): string {
  if (local) return `Atendimento ágil e transparente em ${local}.`;
  return "Ágil, transparente e feito sob medida para o seu momento.";
}

// Indicadores de confiança do hero — só dado real cadastrado.
export function gerarIndicadoresConfianca(empresa: Empresa, local: string): { icone: string; texto: string }[] {
  const itens: { icone: string; texto: string }[] = [];
  if (local) itens.push({ icone: "pin", texto: local });
  const especialidade = normalizarEspecialidade(empresa.especialidade);
  if (especialidade) itens.push({ icone: "target", texto: especialidade });
  if (empresa.nota_google) itens.push({ icone: "star", texto: `${empresa.nota_google} ${empresa.num_avaliacoes ? `(${empresa.num_avaliacoes} avaliações)` : "no Google"}` });
  if (empresa.horario_funcionamento) itens.push({ icone: "clock", texto: empresa.horario_funcionamento });
  return itens.slice(0, 4);
}

// Títulos de seção — cada um tenta usar especialidade/local reais antes de
// cair num fallback genérico. Evita deliberadamente as frases template
// ("Conheça um pouco mais", "Somos especialistas", "Empresa pensada para
// você") e qualquer construção que exija concordância de gênero com o nome.
export function gerarTituloSobre(empresa: Empresa): string {
  const especialidade = normalizarEspecialidade(empresa.especialidade);
  if (especialidade) return `${tituloCase(especialidade)}, do jeito certo.`;
  return "Conheça nossa empresa";
}

export function gerarTituloServicos(empresa: Empresa): string {
  const especialidade = normalizarEspecialidade(empresa.especialidade);
  if (especialidade) return `Serviços em ${especialidade.toLowerCase()}`;
  return "O que oferecemos";
}

export function gerarTituloGaleria(empresa: Empresa): string {
  const especialidade = normalizarEspecialidade(empresa.especialidade);
  if (especialidade) return `${tituloCase(especialidade)} em imagens`;
  return "Nosso trabalho em imagens";
}

export function gerarTituloDepoimentos(): string {
  return "O que dizem sobre o atendimento";
}

export function gerarTituloContato(local: string): string {
  if (local) return `Fale com a gente em ${local}`;
  return "Fale com a gente";
}

export function gerarTituloCtaFinal(empresa: Empresa): string {
  const especialidade = normalizarEspecialidade(empresa.especialidade);
  if (especialidade) return `Quer saber mais sobre ${especialidade.toLowerCase()}?`;
  return "Vamos conversar sobre o que você precisa?";
}
