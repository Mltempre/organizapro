// Executa a rota real POST /api/site-publico/interesse contra um banco simulado
// que aplica os índices únicos reais de oportunidades_demanda:
//   (clinica_id, chave_idempotencia)                       — alvo do upsert
//   (clinica_id, canal, identificador_canal) WHERE identificador_canal IS NOT NULL
//   (clinica_id, telefone_normalizado) WHERE status não terminal
// Nunca usa rede nem banco reais.
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
const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SLUGS = { "loja-a": TENANT_A, "loja-b": TENANT_B };
const TERMINAIS = ["convertida", "perdida", "expirada"];

function bancoSimulado() {
  const linhas = [];
  let seq = 0;
  const viola = (r, ignorar) => linhas.find(o => o !== ignorar && o.clinica_id === r.clinica_id && (
    (r.identificador_canal != null && o.canal === r.canal && o.identificador_canal === r.identificador_canal) ||
    (!TERMINAIS.includes(r.status) && !TERMINAIS.includes(o.status) && o.telefone_normalizado === r.telefone_normalizado)));
  const db = {
    rpc(nome, args) {
      const clinica = nome === "site_publico_por_slug_v2" && args.p_produto === "organizapro" ? SLUGS[args.p_slug] : undefined;
      return { maybeSingle: async () => ({ data: clinica ? { clinica_id: clinica } : null, error: null }) };
    },
    from(tabela) {
      if (tabela !== "oportunidades_demanda") throw new Error("tabela inesperada: " + tabela);
      return {
        upsert(valor, opcoes) {
          assert.equal(opcoes.onConflict, "clinica_id,chave_idempotencia");
          const executar = async () => {
            const existente = linhas.find(o => o.clinica_id === valor.clinica_id && o.chave_idempotencia != null
              && o.chave_idempotencia === valor.chave_idempotencia);
            const candidato = existente ? { ...existente, ...valor } : { status: "sinalizada", ...valor, id: `op-${++seq}` };
            if (viola(candidato, existente)) return { data: null, error: { code: "23505", message: "duplicate key" } };
            if (existente) Object.assign(existente, valor); else linhas.push(candidato);
            return { data: { id: (existente ?? candidato).id }, error: null };
          };
          return { select: () => ({ single: executar }) };
        },
      };
    },
  };
  return { db, linhas };
}

function carregarRota(db) {
  const cache = new Map();
  function carregar(arquivo) {
    if (cache.has(arquivo)) return cache.get(arquivo).exports;
    const modulo = { exports: {} };
    cache.set(arquivo, modulo);
    const codigo = ts.transpileModule(fs.readFileSync(arquivo, "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const requerer = nome => {
      if (nome === "@supabase/supabase-js") return { createClient: () => db };
      if (nome === "next/server") return { NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200 }) } };
      if (nome.startsWith(".")) return carregar(path.resolve(path.dirname(arquivo), nome) + ".ts");
      throw new Error("import proibido: " + nome);
    };
    vm.runInNewContext(codigo, { module: modulo, exports: modulo.exports, require: requerer, process: { env: {} },
      console: { log() {}, info() {}, warn() {}, error() {} } }, { filename: arquivo });
    return modulo.exports;
  }
  return carregar(path.join(root, "app/api/site-publico/interesse/route.ts"));
}

const enviar = (rota, corpo) => rota.POST({ json: async () => corpo });
const interesse = (extra = {}) => ({ slug: "loja-a", nome: "Pessoa", telefone: "(41) 98888-0001",
  servico_nome: "Corte premium", idempotency_key: "chave-1", ...extra });

test("o banco simulado aplica o índice de identificador_canal (prova da regressão antiga)", async () => {
  const { db, linhas } = bancoSimulado();
  const up = v => db.from("oportunidades_demanda").upsert(v, { onConflict: "clinica_id,chave_idempotencia" }).select("id").single();
  const base = { clinica_id: TENANT_A, canal: "site", identificador_canal: "servico:Corte premium" };
  assert.equal((await up({ ...base, chave_idempotencia: "k1", telefone_normalizado: "5541988880001" })).error, null);
  assert.equal((await up({ ...base, chave_idempotencia: "k2", telefone_normalizado: "5541988880002" })).error.code, "23505");
  assert.equal(linhas.length, 1);
});

test("pessoa A e pessoa B no mesmo serviço: ambas registradas", async () => {
  const { db, linhas } = bancoSimulado(); const rota = carregarRota(db);
  const a = await enviar(rota, interesse());
  const b = await enviar(rota, interesse({ nome: "Outra pessoa", telefone: "(41) 98888-0002", idempotency_key: "chave-2" }));
  assert.equal(a.status, 201); assert.equal(b.status, 201);
  assert.notEqual(a.body.id, b.body.id);
  assert.equal(linhas.length, 2);
});

test("serviço preservado em contexto_classificacao; identificador_canal não usa o serviço", async () => {
  const { db, linhas } = bancoSimulado(); const rota = carregarRota(db);
  await enviar(rota, interesse());
  assert.equal(linhas[0].identificador_canal, null);
  assert.equal(linhas[0].canal, "site");
  assert.equal(linhas[0].contexto_classificacao.servico_nome, "Corte premium");
  assert.equal(linhas[0].chave_idempotencia, "interesse-publico:chave-1");
});

test("mesma chave idempotente repetida: mesmo resultado, sem duplicidade", async () => {
  const { db, linhas } = bancoSimulado(); const rota = carregarRota(db);
  const r1 = await enviar(rota, interesse());
  const r2 = await enviar(rota, interesse());
  const r3 = await enviar(rota, interesse());
  assert.deepEqual([r1.status, r2.status, r3.status], [201, 201, 201]);
  assert.equal(r2.body.id, r1.body.id); assert.equal(r3.body.id, r1.body.id);
  assert.equal(linhas.length, 1);
});

test("mesmo telefone com oportunidade aberta continua protegido; após estado terminal volta a aceitar", async () => {
  const { db, linhas } = bancoSimulado(); const rota = carregarRota(db);
  assert.equal((await enviar(rota, interesse())).status, 201);
  const repetido = await enviar(rota, interesse({ servico_nome: "Barba", idempotency_key: "chave-nova" }));
  assert.notEqual(repetido.status, 201);
  assert.equal(repetido.body.sucesso, false);
  assert.equal(linhas.length, 1);
  linhas[0].status = "perdida";
  assert.equal((await enviar(rota, interesse({ servico_nome: "Barba", idempotency_key: "chave-nova" }))).status, 201);
  assert.equal(linhas.length, 2);
});

test("isolamento por tenant: tenant vem do slug; mesma chave/telefone em outro negócio não colide nem vaza", async () => {
  const { db, linhas } = bancoSimulado(); const rota = carregarRota(db);
  const a = await enviar(rota, interesse({ clinica_id: TENANT_B }));
  const b = await enviar(rota, interesse({ slug: "loja-b" }));
  assert.equal(a.status, 201); assert.equal(b.status, 201); assert.notEqual(a.body.id, b.body.id);
  assert.deepEqual(linhas.map(l => l.clinica_id).sort(), [TENANT_A, TENANT_B]);
  assert.equal((await enviar(rota, interesse({ slug: "inexistente" }))).status, 404);
  assert.equal(linhas.length, 2);
});

test("validações de entrada preservadas", async () => {
  const { db, linhas } = bancoSimulado(); const rota = carregarRota(db);
  assert.equal((await enviar(rota, interesse({ idempotency_key: undefined }))).status, 400);
  assert.equal((await enviar(rota, interesse({ telefone: "123" }))).status, 400);
  assert.equal(linhas.length, 0);
});
