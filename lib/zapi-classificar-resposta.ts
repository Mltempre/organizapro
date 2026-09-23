// Classificação pura de respostas recebidas pelo webhook Z-API.

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const CONFIRMAR_EXATO = new Set([
  "s",
  "\u{1F44D}", // 👍
  "✅",
  "estarei la",
  "estou indo",
  "pode confirmar",
]);

const REAGENDAR_EXATO = new Set(["n"]);

const CONFIRMAR_PREFIXO = ["sim", "confirmo", "confirmado", "ok", "certo"];
const REAGENDAR_PREFIXO = ["nao", "cancelar", "cancela", "reagendar", "remarcar"];

function iniciaCom(texto: string, palavra: string): boolean {
  if (texto === palavra) return true;
  if (!texto.startsWith(palavra)) return false;
  return /^[\s,!.?]/.test(texto.slice(palavra.length));
}

export function classificarResposta(texto: string): "confirmar" | "reagendar" | "ignorar" {
  const t = normalizar(texto);
  if (CONFIRMAR_EXATO.has(t)) return "confirmar";
  if (REAGENDAR_EXATO.has(t)) return "reagendar";
  if (CONFIRMAR_PREFIXO.some((p) => iniciaCom(t, p))) return "confirmar";
  if (REAGENDAR_PREFIXO.some((p) => iniciaCom(t, p))) return "reagendar";
  return "ignorar";
}
