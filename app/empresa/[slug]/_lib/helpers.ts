import type { Empresa } from "./types";

export const initials = (nome: string) =>
  nome.trim().split(" ").filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 2).join("");

export const safeData = <T,>(res: { data: T[] | null; error: { code?: string } | null }) =>
  res.error ? [] : (res.data ?? []);

// Texto "Sobre a empresa" — gerado só a partir de dados reais cadastrados,
// dividido em blocos curtos (parágrafos editoriais, não um bloco único).
// Nunca é texto fixo genérico, nunca é informação inventada: cada frase só
// existe se o campo correspondente existir no banco.
export function gerarSobre(empresa: Empresa, qtdEquipe: number): string[] {
  const blocos: string[] = [];
  const local = [empresa.cidade, empresa.estado].filter(Boolean).join(", ");
  if (empresa.especialidade && local) {
    blocos.push(`A ${empresa.nome} atua em ${empresa.especialidade.toLowerCase()} e está localizada em ${local}.`);
  } else if (empresa.especialidade) {
    blocos.push(`A ${empresa.nome} atua em ${empresa.especialidade.toLowerCase()}.`);
  } else if (local) {
    blocos.push(`A ${empresa.nome} está localizada em ${local}.`);
  } else {
    blocos.push(`A ${empresa.nome} é uma empresa comprometida em oferecer o melhor atendimento aos seus clientes.`);
  }
  const segundo: string[] = [];
  if (qtdEquipe > 0) {
    segundo.push(`Contamos com uma equipe de ${qtdEquipe} profissional${qtdEquipe > 1 ? "is" : ""} dedicada${qtdEquipe > 1 ? "s" : ""} a oferecer um atendimento próximo e de confiança.`);
  }
  segundo.push("Cada atendimento é conduzido com organização e transparência, do primeiro contato ao resultado final.");
  blocos.push(segundo.join(" "));
  return blocos;
}

// Headline do hero — curta e editorial, para quebrar bem em 2-3 linhas.
// Não repete a especialidade (já aparece no selo acima) — foca em uma
// promessa institucional universal.
export function gerarTituloHero(): string {
  return "Um padrão de atendimento acima da média.";
}

// Subtítulo comercial curto do hero — copy universal, não depende do nome
// (evita frases como "Fale agora com Sua Empresa").
export function gerarSubtituloHero(): string {
  return "Atendimento ágil, personalizado e feito para gerar resultado.";
}
