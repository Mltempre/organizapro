// Executa o Server Component real app/empresa/[slug]/page.tsx com dependências
// simuladas: slug inexistente segue notFound() (HTTP 404 real no Next.js);
// site válido continua renderizando; falha transitória da consulta não vira 404.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arquivo = path.join(root, "app/empresa/[slug]/page.tsx");
const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";
const TENANT = "11111111-1111-4111-8111-111111111111";

function carregarPagina(respostaRpc) {
  const chamadas = { rpc: [], persistir: 0 };
  const supabase = {
    rpc(nome, args) {
      chamadas.rpc.push({ nome, args });
      return { maybeSingle: async () => respostaRpc(args) };
    },
  };
  const SiteEmpresaClient = function SiteEmpresaClient() {};
  const stubs = {
    "next/headers": { headers: async () => new Map([["referer", null]]) },
    "next/navigation": { notFound: () => { const e = new Error(NOT_FOUND); e.digest = NOT_FOUND; throw e; } },
    "@supabase/supabase-js": { createClient: () => ({}) },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    "../../../lib/supabase": { supabase },
    "./SiteEmpresaClient": { default: SiteEmpresaClient, __esModule: true },
    "./_lib/helpers": { normalizarEspecialidade: v => v ?? "" },
    "../../../lib/atribuicao-origem": {
      capturarOrigem: () => ({ utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, gclid: null, fbclid: null, referrerHost: null, capturadoEm: "2026-09-25T00:00:00.000Z" }),
      classificarOrigem: () => "direto", gerarCodigoOrigem: () => "codigo123",
    },
    "../../../lib/origem-persistencia": { persistirOrigemCaptada: async () => { chamadas.persistir++; } },
    "../../../lib/ads-contratos": { capturarIdentificadoresAds: () => ({}) },
  };
  const codigo = ts.transpileModule(fs.readFileSync(arquivo, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const modulo = { exports: {} };
  vm.runInNewContext(codigo, {
    module: modulo, exports: modulo.exports, process: { env: {} }, URLSearchParams,
    console: { log() {}, warn() {}, error() {}, info() {} },
    require: nome => { if (nome in stubs) return stubs[nome]; throw new Error("import não previsto: " + nome); },
  }, { filename: arquivo });
  return { pagina: modulo.exports, chamadas, SiteEmpresaClient };
}

const props = slug => ({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) });
const valido = args => args.p_slug === "organizapro"
  ? { data: { clinica_id: TENANT, nome: "OrganizaPro", especialidade: "", cidade: null, estado: null }, error: null }
  : { data: null, error: null };

test("site válido (/empresa/organizapro) continua renderizando o SiteEmpresaClient", async () => {
  const { pagina, chamadas, SiteEmpresaClient } = carregarPagina(valido);
  const el = await pagina.default(props("organizapro"));
  assert.equal(el.type, SiteEmpresaClient);
  assert.equal(el.props.slug, "organizapro");
  assert.equal(el.props.codigoRastreio, "codigo123");
  assert.equal(chamadas.persistir, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(chamadas.rpc[0])), { nome: "site_publico_por_slug_v2", args: { p_slug: "organizapro", p_produto: "organizapro" } });
});

test("slug inexistente segue notFound() (404 real) e não captura origem", async () => {
  const { pagina, chamadas } = carregarPagina(valido);
  await assert.rejects(pagina.default(props("clinica-sorrisos")), e => e.digest === NOT_FOUND);
  assert.equal(chamadas.persistir, 0);
});

test("resposta sem nome também é tratada como inexistente", async () => {
  const { pagina } = carregarPagina(() => ({ data: { clinica_id: TENANT, nome: null }, error: null }));
  await assert.rejects(pagina.default(props("sem-nome")), e => e.digest === NOT_FOUND);
});

test("falha transitória da consulta NÃO vira 404 (comportamento anterior preservado)", async () => {
  const { pagina, chamadas, SiteEmpresaClient } = carregarPagina(() => ({ data: null, error: { code: "08006", message: "conexão" } }));
  const el = await pagina.default(props("organizapro"));
  assert.equal(el.type, SiteEmpresaClient);
  assert.equal(el.props.codigoRastreio, undefined);
  assert.equal(chamadas.persistir, 0);
});

test("metadata inalterada: válido usa o nome; inexistente mantém o título de não encontrado", async () => {
  const { pagina } = carregarPagina(valido);
  assert.equal((await pagina.generateMetadata(props("organizapro"))).title, "OrganizaPro");
  assert.equal((await pagina.generateMetadata(props("inexistente"))).title, "Site não encontrado | OrganizaPro");
});
