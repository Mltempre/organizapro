import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filename = path.join(root, 'app/atribuicao/page.tsx');
const source = fs.readFileSync(filename, 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
function render(dados, loading = false, erro = '') {
  const estados = [dados, loading, erro]; let index = 0;
  const original = Module._load;
  Module._load = function(request, parent, isMain) {
    if (request === 'react') return { ...React, useState: inicial => [index < estados.length ? estados[index++] : (index++, inicial), () => {}], useEffect: () => {}, useCallback: f => f };
    if (request === 'next/navigation') return { useRouter: () => ({ push() {} }) };
    if (request.endsWith('/supabase')) return { supabase: {} };
    if (request.endsWith('/AdminShell')) return { __esModule: true, default: ({ children }) => React.createElement('main', null, children) };
    if (request.endsWith('/PageLoader')) return { __esModule: true, default: ({ title }) => React.createElement('p', null, title) };
    if (request.endsWith('/EmptyState')) return { __esModule: true, default: ({ title }) => React.createElement('p', null, title) };
    if (request.endsWith('/Feedback')) return { __esModule: true, default: ({ message }) => React.createElement('p', { role: 'alert' }, message) };
    if (request.endsWith('/atribuicao-relatorio')) return { TIPOS_VINCULO_ATRIBUICAO: ['cliente','oportunidade','agendamento','orcamento','pedido','cobranca'] };
    if (request.endsWith('/ads-contratos')) return { CONEXOES_ADS_V1: [{ plataforma: 'google_ads' }, { plataforma: 'meta_ads' }] };
    return original.call(this, request, parent, isMain);
  };
  try {
    const m = new Module(filename); m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename));
    m._compile(compiled, filename);
    return renderToStaticMarkup(React.createElement(m.exports.default));
  } finally { Module._load = original; }
}
const vazio = { origens: [], vinculos: [], relatorio: { linhas: [], pagamentos: [], trilhas: [], capturasSemVinculo: 0, receitaAtribuidaCentavos: 0, receitaNaoAtribuidaCentavos: 0 } };
test('UI real renderiza loading e erro sem fabricar totais ou chamar rede', () => {
  assert.match(render(null, true), /Conferindo origens/);
  const html = render(null, false, 'Fonte indisponível');
  assert.match(html, /role="alert"/); assert.doesNotMatch(html, /Receita com vínculo/);
});
test('UI real renderiza vazio honesto e conexões não configuradas', () => {
  const html = render(vazio);
  assert.match(html, /Nenhuma origem capturada/); assert.match(html, /integração oficial não conectada/);
  assert.doesNotMatch(html, /Registrar evidência/);
});
test('UI real apresenta campanha, pagamento, incerteza e formulário de evidência', () => {
  const d = structuredClone(vazio);
  d.origens = [{ id: 'origem-1', source: 'google', campanha: '<campanha>', capturadoEm: '2026-09-01' }];
  d.relatorio.receitaNaoAtribuidaCentavos = 2500;
  d.relatorio.linhas = [{ chave: 'g', plataforma: 'google_ads', fonte: 'google', campanha: '<campanha>', anuncio: null, capturas: 1, leads: 1, clientes: 1, oportunidades: 1, orcamentos: 0, pedidos: 1, agendamentos: 0, conversoes: 0, receitaCentavos: 0 }];
  d.relatorio.pagamentos = [{ tipo: 'pedido', id: 'p-1', nome: 'Cliente teste', valorCentavos: 2500, origemId: null, motivo: 'Origens conflitantes', trilha: [{ etapa: 'pedido', id: 'p-1' }] }];
  d.relatorio.trilhas = [{ tipo: 'pedido', id: 'p-1', nome: 'Cliente teste', estado: 'incerto', origens: ['a','b'] }];
  const html = render(d);
  assert.match(html, /&lt;campanha&gt;/); assert.match(html, /Origens conflitantes/);
  assert.match(html, /Registrar evidência/); assert.match(html, /Não atribuído/);
  assert.match(html, /25,00/);
});
