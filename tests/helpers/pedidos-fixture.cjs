/* eslint-disable @typescript-eslint/no-require-imports -- Isolated route tests, no network. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');

function fixture() {
  const tables = { pedidos: [], pedido_itens: [], eventos_dominio: [], pacientes: [{ id: 'client-a', clinica_id: 'a' }],
    clinica_servicos: [{ id: 'service-a', clinica_id: 'a', nome: 'Serviço local A', preco_centavos: 1500, disponivel: true },
      { id: 'service-b', clinica_id: 'b', nome: 'Serviço local B', preco_centavos: 700, disponivel: true }] };
  const calls = [], faults = [], cache = new Map(); let serial = 0;
  function query(table, rpc) {
    const q = { table, action: 'select', filters: [], value: null }; calls.push(q);
    let single = false;
    const chain = {
      select() { return chain; }, order() { return chain; },
      eq(k, v) { q.filters.push([k, v]); return chain; },
      in(k, vs) { q.filters.push([k, vs]); return chain; },
      insert(v) { q.action = 'insert'; q.value = v; return chain; },
      update(v) { q.action = 'update'; q.value = v; return chain; },
      delete() { q.action = 'delete'; return chain; },
      single() { single = true; return run(); }, maybeSingle() { single = true; return run(); },
      then(ok, fail) { return run().then(ok, fail); },
    };
    const matches = r => q.filters.every(([k, v]) => Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
    async function run() {
      const fault = faults.findIndex(f => f.table === table && f.action === q.action);
      if (fault >= 0) { faults.splice(fault, 1); return { data: null, error: { message: 'local failure' } }; }
      if (rpc) return { data: rpc.p_slug === 'a' ? { clinica_id: 'a' } : null, error: null };
      if (!tables[table]) throw Error('Unexpected table ' + table);
      let rows = tables[table].filter(matches);
      if (q.action === 'insert') {
        const input = Array.isArray(q.value) ? q.value : [q.value];
        if (table === 'eventos_dominio' && input.some(r => tables[table].some(e => e.clinica_id === r.clinica_id && e.chave_idempotencia === r.chave_idempotencia))) return { data: null, error: { message: 'unique' } };
        rows = input.map(r => ({ id: `id-${++serial}`, ...r })); tables[table].push(...rows);
      }
      if (q.action === 'update') rows.forEach(r => Object.assign(r, q.value));
      if (q.action === 'delete') tables[table] = tables[table].filter(r => !matches(r));
      const data = rows.map(r => table === 'pedidos' ? { ...r, pedido_itens: tables.pedido_itens.filter(i => i.pedido_id === r.id) } : { ...r });
      return { data: single ? data[0] ?? null : data, error: null };
    }
    return chain;
  }
  const db = { from: table => query(table), rpc: (_name, args) => query('rpc', args) };
  function load(relative) {
    const file = path.resolve(root, relative);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    function localRequire(name) {
      if (name === '@supabase/supabase-js') return { createClient: () => db };
      if (name === 'next/server') return { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } };
      if (name.endsWith('/auth-clinica')) return { autorizarUsuarioNaClinica: async (req, tenant) => req.tenant === tenant ? { ok: true, userId: 'local-user' } : { ok: false, status: 403, error: 'Sem vínculo' } };
      if (name.endsWith('/log-estruturado')) return { logOperacao() {} };
      if (name.endsWith('/atribuicao-vinculos')) return { vincularOrigemPublica: async () => {} };
      if (name.endsWith('/auditoria-resultado-persistencia')) return { registrarResultadoSeHouveDecisao: async () => {} };
      if (name.endsWith('/whatsapp-governado')) return { entidadeIdDeTelefone: () => 'local-contact' };
      if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(file), name + '.ts')));
      throw Error('Forbidden import ' + name);
    }
    vm.runInNewContext(code, { module: mod, exports: mod.exports, require: localRequire, URL,
      process: { env: {} }, console, fetch: () => { throw Error('External access forbidden'); } }, { filename: file });
    return mod.exports;
  }
  return { tables, calls, faults, load, request: (body, tenant = 'a') => ({ tenant, json: async () => body, url: `https://local.invalid/api/pedidos?clinica_id=${body?.clinica_id ?? tenant}` }) };
}
module.exports = { fixture };
