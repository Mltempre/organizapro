// Convergência Comercial — Fase 1 (sem SQL): dado que o OrganizaPro já
// conhece não é pedido de novo. Oportunidade → Orçamento → Serviço
// contratado → Cobrança reaproveitam a origem; o usuário sempre revisa e
// confirma (nada é registrado sozinho). APIs, banco e motores intocados.
//
// node --test tests/convergencia-comercial-fase1.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ler = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const semComentarios = s => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const orcamentos = ler("app/orcamentos/page.tsx");
const oportunidades = ler("app/oportunidades/page.tsx");
const tratamentos = ler("app/tratamentos/page.tsx");
const cobrancas = ler("app/cobrancas/page.tsx");

// Quantos POSTs cada tela faz e de onde — abrir/navegar/selecionar nunca escreve.
const posts = codigo => [...semComentarios(codigo).matchAll(/fetch\(([^,]+),\s*\{\s*method: 'POST'/g)].map(m => m[1].trim());

test("Bloco 4 — Gerar orçamento usa o MESMO seletor de catálogo do Novo orçamento (sem lógica duplicada)", () => {
  for (const p of [orcamentos, oportunidades]) {
    assert.match(p, /import ItensCatalogoOrcamento, \{[^}]*\} from '\.\.\/components\/ItensCatalogoOrcamento'/);
    assert.match(p, /<ItensCatalogoOrcamento\s+catalogo=\{catalogo\}\s+itens=\{form\.itens\}/);
    assert.match(p, /\.filter\(itemVendavel\)/);
    assert.doesNotMatch(semComentarios(p), /comporOrcamentoDoCatalogo|function adicionarItem|function aplicarItens/, "composição mora só no componente");
  }
  const c = semComentarios(oportunidades);
  assert.match(c, /supabase\.from\('clinica_servicos'\)\.select\('id, nome, preco_centavos, disponivel'\)\.eq\('clinica_id', cid\)\.order\('ordem'\)/);
  assert.doesNotMatch(c, /from\('[a-z_]+'\)[^;]*\.(insert|update|upsert|delete)\(/, "a tela não escreve em tabela nenhuma diretamente");
});

test("Bloco 4 — Gerar orçamento continua no MESMO contrato da API (descrição/valor editáveis; catálogo opcional; itens não viajam)", () => {
  const c = semComentarios(oportunidades);
  assert.match(c, /fetch\(`\/api\/oportunidades\/\$\{modalOrcamento\.id\}\/gerar-orcamento`/);
  assert.match(c, /paciente_nome: form\.paciente_nome\.trim\(\),\s*procedimento: form\.procedimento\.trim\(\),\s*valor: valorNumerico,/);
  assert.doesNotMatch(c, /itens: form\.itens|servico_id/);
  // descrição e valor continuam campos livres
  assert.match(c, /value=\{form\.procedimento\} onChange=/);
  assert.match(c, /value=\{form\.valor\} onChange=/);
  // telefone já conhecido aparece (vem da oportunidade; a API já o usa)
  assert.match(oportunidades, /data-testid="oportunidade-telefone"[\s\S]{0,300}\{modalOrcamento\.telefone\}/);
  assert.match(ler("app/api/oportunidades/[id]/gerar-orcamento/route.ts"), /telefone: oportunidade\.telefone,/);
  assert.deepEqual(posts(oportunidades), ["`/api/oportunidades/${op.id}/transicao`", "`/api/oportunidades/${modalOrcamento.id}/gerar-orcamento`"]);
});

test("Bloco 3 — orçamento APROVADO leva ao formulário EXISTENTE de Serviços contratados, sem registrar nada", () => {
  const c = semComentarios(orcamentos);
  assert.match(c, /\{o\.status === 'aprovado' && \(\s*<button[\s\S]*?onClick=\{\(\) => router\.push\(`\/tratamentos\?orcamento=\$\{encodeURIComponent\(o\.id\)\}`\)\}[\s\S]*?Registrar serviço contratado/);
  assert.deepEqual(posts(orcamentos), ["'/api/orcamentos'", "`/api/orcamentos/${o.id}/transicao`"], "nenhum POST novo em Orçamentos");
});

test("Bloco 1/3 — Serviços contratados: orçamento de origem preenche nome, TELEFONE, serviço e valor; abre pela URL só para revisão", () => {
  const c = semComentarios(tratamentos);
  assert.match(c, /type OrcamentoPicker = \{ id: string; paciente_nome: string; telefone: string \| null; procedimento: string; valor: number \}/);
  assert.match(c, /function dadosDoOrcamento\(o: OrcamentoPicker\)[\s\S]*?orcamentoId: o\.id,\s*paciente_nome: o\.paciente_nome,\s*telefone: o\.telefone \? normalizar\(o\.telefone\) : '',\s*tipo_tratamento: o\.procedimento,\s*valor_estimado: String\(o\.valor\),/);
  assert.match(c, /function selecionarOrcamento[\s\S]*?dadosDoOrcamento\(o\)[\s\S]*?telefone: dados\.telefone \|\| prev\.telefone/);
  // ?orcamento= lido uma vez e só ABRE o formulário preenchido
  assert.match(c, /new URLSearchParams\(window\.location\.search\)\.get\('orcamento'\)/);
  assert.match(c, /setForm\(\{ \.\.\.formInicial, \.\.\.dadosDoOrcamento\(origem\) \}\);\s*idempotencyKeyRef\.current = crypto\.randomUUID\(\);\s*setModalNovo\(true\);/);
  assert.deepEqual(posts(tratamentos), ["'/api/tratamentos'", "`/api/tratamentos/${t.id}/transicao`"], "o único registro continua sendo o 'Registrar serviço' do usuário");
  // avulso continua possível
  assert.match(tratamentos, /— Serviço avulso \(sem orçamento\) —/);
  // contrato da API inalterado: o vínculo já existia
  assert.match(c, /orcamento_origem_id: form\.orcamentoId \|\| undefined,/);
  assert.match(c, /paciente_telefone: form\.telefone \? normalizar\(form\.telefone\) : undefined,/);
});

test("Bloco 2 — Cobrança: serviço de origem preenche cliente cadastrado, nome, TELEFONE, descrição e valor", () => {
  const c = semComentarios(cobrancas);
  assert.match(c, /type TratamentoPicker = \{ id: string; paciente_id: string \| null; paciente_nome: string; paciente_telefone: string \| null; tipo_tratamento: string; valor_estimado: number \| null \}/);
  assert.match(c, /function selecionarTratamento[\s\S]*?pacienteId: clienteDaOrigem \?\? prev\.pacienteId,[\s\S]*?telefone: t\?\.paciente_telefone \? normalizar\(t\.paciente_telefone\) : prev\.telefone,[\s\S]*?descricao: t \? t\.tipo_tratamento : prev\.descricao,/);
  assert.deepEqual(posts(cobrancas).filter(x => x === "'/api/cobrancas'"), ["'/api/cobrancas'"]);
});

test("Bloco 2 — Cobrança envia telefone e cliente nos campos que a API REALMENTE lê (antes 'telefone' era descartado)", () => {
  const c = semComentarios(cobrancas);
  const api = ler("app/api/cobrancas/route.ts");
  assert.match(api, /clinica_id, paciente_id, paciente_nome, paciente_telefone,/);
  assert.match(c, /paciente_id: form\.pacienteId \|\| undefined,\s*paciente_nome: form\.paciente_nome\.trim\(\),\s*paciente_telefone: form\.telefone \? normalizar\(form\.telefone\) : undefined,\s*tratamento_origem_id: form\.tratamentoId \|\| undefined,/);
  assert.doesNotMatch(c, /^\s*telefone: form\.telefone/m, "chave que a API ignorava não existe mais");
});

test("Formulários do fluxo ficam contidos na área visível (mesma correção do Novo orçamento)", () => {
  for (const [nome, p] of [["oportunidades", oportunidades], ["tratamentos", tratamentos], ["cobrancas", cobrancas], ["orcamentos", orcamentos]]) {
    assert.match(p, /maxWidth: 480, maxHeight: '100%', boxSizing: 'border-box', overflowY: 'auto', overscrollBehavior: 'contain'/, nome);
    assert.doesNotMatch(p, /maxWidth: 480, maxHeight: '90vh'/, nome);
  }
});

test("Fase 1 não toca APIs, banco, Pedidos, Estoque, Receita Perdida, Follow-up nem Pesquisa de Preços", () => {
  for (const p of [orcamentos, oportunidades, tratamentos, cobrancas, ler("app/components/ItensCatalogoOrcamento.tsx")]) {
    assert.doesNotMatch(semComentarios(p), /\.rpc\(|pedido_itens|estoque|receita-perdida|follow-up-comercial|pesquisa-precos/);
  }
});
