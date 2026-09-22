// P1.1 — Fechar a Casa do OrganizaPro. Verificação estática do que o
// motor puro (tests/onboarding-negocio.test.mjs) não cobre: que a
// arquitetura real (rota, componente, gate no shell) está de fato
// ligada — nunca "existe no código" sem estar acessível.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

function arquivosTs(diretorios) {
  const resultado = [];
  const IGNORAR = new Set(["node_modules", ".next", ".git"]);
  function varrer(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      if (IGNORAR.has(entrada.name)) continue;
      const caminho = path.join(dir, entrada.name);
      if (entrada.isDirectory()) varrer(caminho);
      else if (/\.(ts|tsx)$/.test(entrada.name)) resultado.push(caminho);
    }
  }
  for (const d of diretorios) varrer(path.join(root, d));
  return resultado;
}

// ── Causa raiz do vínculo negócio/usuário ────────────────────────────────

test("POST /api/minha-clinica/provisionar: sempre service-role (RLS não libera INSERT em clinicas/clinica_usuarios para authenticated)", () => {
  const codigo = ler("app/api/minha-clinica/provisionar/route.ts");
  assert.match(codigo, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(codigo, /decidirProvisionamento/, "deve delegar a decisão ao motor puro, nunca reimplementar a regra na rota");
});

test("POST /api/minha-clinica/provisionar: nunca lê clinica_id do body (auth.uid() é a única fonte do vínculo)", () => {
  const codigo = ler("app/api/minha-clinica/provisionar/route.ts");
  assert.doesNotMatch(codigo, /body\.clinica_id/);
});

test("POST /api/minha-clinica/provisionar: falha ao criar o vínculo desfaz a clinica órfã (compensação, nunca deixa negócio sem dono)", () => {
  const codigo = ler("app/api/minha-clinica/provisionar/route.ts");
  const idxInsertVinculo = codigo.indexOf('.insert({ clinica_id: novaClinica.id');
  const trecho = codigo.slice(idxInsertVinculo, idxInsertVinculo + 300);
  assert.match(trecho, /erroVinculoNovo/);
  assert.match(trecho, /\.from\("clinicas"\)\.delete\(\)\.eq\("id", novaClinica\.id\)/);
});

test("AdminShellFrame: gate de tenant montado UMA vez na chrome persistente — nunca remendo por página", () => {
  const codigo = ler("app/components/AdminShellFrame.tsx");
  assert.match(codigo, /import NegocioNaoVinculado from ".\/NegocioNaoVinculado"/);
  assert.match(codigo, /api\/minha-clinica/);
  assert.match(codigo, /res\.status === 404/);
});

test("AdminShellFrame: sem sessão nunca aciona o gate de tenant — cada página continua responsável pelo próprio redirect de login", () => {
  const codigo = ler("app/components/AdminShellFrame.tsx");
  const idx = codigo.indexOf("useEffect(() => {\n    let cancelado");
  const trecho = codigo.slice(idx, idx + 500);
  assert.match(trecho, /if \(!session\?\.access_token \|\| cancelado\) return;/);
});

test("AdminShellFrame: quando sem vínculo, troca {children} pela tela de provisionamento (nunca some em branco)", () => {
  const codigo = ler("app/components/AdminShellFrame.tsx");
  assert.match(codigo, /semVinculo\s*\?\s*<NegocioNaoVinculado/);
});

test("todas as ~27 páginas que dependem de /api/minha-clinica ficam sob ROTAS_COM_SHELL (o gate cobre todas de uma vez)", () => {
  const adminShellFrame = ler("app/components/AdminShellFrame.tsx");
  const paginasComMinhaClinica = arquivosTs(["app"])
    .filter((f) => /page\.tsx$/.test(f) && ler(path.relative(root, f)).includes("api/minha-clinica"))
    .map((f) => {
      const rel = path.relative(path.join(root, "app"), path.dirname(f)).replace(/\\/g, "/");
      return "/" + rel.replace(/\[.*?\]/g, "x").split("/")[0]; // rota-base (primeiro segmento real)
    });
  const unicos = [...new Set(paginasComMinhaClinica)];
  for (const rota of unicos) {
    // /configuracoes entra em ROTAS_COM_SHELL fora de navGrupos (item de
    // rodapé, não de menu) — mesmo padrão de sempre, checado à parte.
    const padrao = rota === "/configuracoes" ? /"\/configuracoes"/ : new RegExp(`h: "${rota.replace("/", "\\/")}"`);
    assert.match(adminShellFrame, padrao, `${rota} deveria estar sob ROTAS_COM_SHELL (coberta pelo gate)`);
  }
});

// ── Item 4: terminologia legada "Clínica" nunca visível ao usuário ───────

test("Raio-X: nunca mais devolve 'Clínica não encontrada' — usa a mesma frase canônica das demais telas (Negócio não vinculado ao usuário)", () => {
  const codigo = ler("app/api/raio-x/route.ts");
  assert.doesNotMatch(codigo, /Clínica não encontrada/);
  assert.match(codigo, /Negócio não vinculado ao usuário\./);
});

test("Cliente 360 (não encontrado) e NotaFácil (sem vínculo): usam 'negócio', nunca 'clínica', no texto visível ao usuário", () => {
  assert.doesNotMatch(ler("app/clientes/[id]/page.tsx"), /pertence a esta clínica/);
  assert.doesNotMatch(ler("app/notafacil/page.tsx"), /vínculo de clínica/);
});

// ── Item 5: NotaFácil nunca fica em loading infinito ─────────────────────

test("NotaFácil: fetch tem timeout real (AbortController) e todo caminho (sucesso/erro/exceção) sempre encerra o loading", () => {
  const codigo = ler("app/notafacil/page.tsx");
  assert.match(codigo, /AbortController/);
  assert.match(codigo, /controller\.abort\(\)/);
  const idxTry = codigo.indexOf("async function carregar()");
  const corpo = codigo.slice(idxTry, idxTry + 2000);
  assert.match(corpo, /catch \(e\)/);
  assert.match(corpo, /finally \{\s*if \(ativo\) setCarregando\(false\);/);
});

// ── Item 7: nada inventado ────────────────────────────────────────────────

test("Copiloto Administrativo: continua sem nenhuma implementação real no repositório", () => {
  const arquivos = arquivosTs(["app", "lib"]).filter((f) => /Copiloto Administrativo/i.test(ler(path.relative(root, f))) && !f.includes("test"));
  assert.deepEqual(arquivos, []);
});
