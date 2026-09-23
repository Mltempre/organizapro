/* eslint-disable @typescript-eslint/no-require-imports -- Harness CommonJS usa Module._extensions para executar TSX localmente sem build ou serviços. */
// Harness exclusivamente local: roda a página e os motores reais com transporte isolado.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../..');

for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (mod, file) => {
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: file,
  });
  mod._compile(compiled.outputText, file);
};
Module._extensions['.css'] = mod => { mod.exports = new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) }); };
const Casa = require(path.join(root, 'app/components/CasaDashboard.tsx')).default;
const render = element => renderToStaticMarkup(element);

async function carregar(options = {}) {
  const state = [], effects = [], calls = [], queries = [], redirects = [];
  let cursor = 0;
  const hooks = {
    ...React,
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
    useCallback(fn) { return fn; },
    useEffect(fn) { if (!effects.length) effects.push(fn); },
  };
  const supabase = {
    auth: { getUser: async () => ({ data: { user: options.semUsuario ? null : { id: 'usuario-teste' } } }), getSession: async () => ({ data: { session: options.semSessao ? null : { access_token: 'token-local-de-teste' } } }) },
    from(table) {
      const q = { table, ops: [] }; queries.push(q);
      const query = new Proxy({}, { get(_, method) {
        if (method === 'then') return (resolve) => {
          const index = queries.indexOf(q);
          const data = options.rows?.[index] ?? (table === 'clinica_config' ? { nome_clinica: 'Empresa de teste', email: 'teste@example.invalid', telefone: '11999999999', endereco: 'Teste' } : []);
          return Promise.resolve({ data, count: options.counts?.[index] ?? 0, error: options.queryError === index ? { message: 'Falha local' } : null }).then(resolve);
        };
        return (...args) => { q.ops.push([method, ...args]); return query; };
      }});
      return query;
    },
  };
  const fetchLocal = async (url, init) => {
    calls.push({ url, init });
    const route = url.split('?')[0];
    if (options.networkError === route) throw Error('Falha de rede local');
    if (route === '/api/minha-clinica') return { ok: !options.semTenant, json: async () => ({ clinica_id: 'tenant-teste' }) };
    if (route === '/api/fechamento/tipos') return { ok: options.apiError !== route, json: async () => options.invalidBody === route ? {} : { sucesso:true, tipos:options.fechamentoTipos ?? [] } };
    if (route === '/api/fechamento') return { ok: options.apiError !== route, json: async () => options.invalidBody === route ? {} : { sucesso:true, resumo:options.fechamentoResumo } };
    const key = { '/api/orcamentos': 'orcamentos', '/api/pedidos': 'pedidos', '/api/tratamentos': 'tratamentos', '/api/cobrancas': 'cobrancas', '/api/oportunidades': 'data' }[route];
    if (!key) throw Error('Acesso não previsto: '+url);
    return { ok: options.apiError !== route, json: async () => options.invalidBody === route ? {} : ({ [key]: options.apiRows?.[key] ?? [] }) };
  };
  const file = path.join(root, 'app/dashboard/page.tsx');
  const compiled = ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const mod = { exports: {} }, realRequire = Module.createRequire(file);
  const localRequire = spec => spec === 'react' ? hooks : spec === 'next/navigation' ? { useRouter: () => ({ push: url => redirects.push(url) }) } : spec === '../../lib/supabase' ? { supabase } : realRequire(spec);
  new Function('exports','require','module','fetch','console',compiled)(mod.exports,localRequire,mod,fetchLocal,{ error() {} });
  const page = () => { cursor = 0; return mod.exports.default(); };
  page(); effects[0]();
  // Await async effect settlement without contacting any service.
  for (let i=0; i<100 && state[0]; i++) await new Promise(resolve => setImmediate(resolve));
  if (state[0]) throw Error('Carga não terminou');
  const element = page();
  return { element, html: render(element), calls, queries, redirects, page, options };
}
module.exports = { carregar, render, Casa, React, root };
