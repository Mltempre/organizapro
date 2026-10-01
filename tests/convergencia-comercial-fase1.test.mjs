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

// ── Convergência Definitiva: Pedidos = Venda/Execução única ─────────────
// Os Blocos 1/3 da Fase 1 levavam a Serviços contratados; agora levam ao
// formulário EXISTENTE de Pedidos. As mesmas garantias continuam: nada é
// registrado sem confirmação, o dado conhecido não é redigitado.

const pedidosPagina = ler("app/pedidos/page.tsx");

test("Bloco 3 — orçamento APROVADO leva ao formulário EXISTENTE de Pedidos (venda), sem registrar nada; uma venda por orçamento", () => {
  const c = semComentarios(orcamentos);
  assert.match(c, /onClick=\{\(\) => router\.push\(`\/pedidos\?orcamento=\$\{encodeURIComponent\(o\.id\)\}`\)\}[\s\S]*?Registrar venda/);
  assert.match(c, /orcamentosComVenda\.has\(o\.id\)[\s\S]*?Venda registrada/, "orçamento com venda não oferece segunda venda");
  assert.doesNotMatch(c, /\/tratamentos\?orcamento=/);
  assert.deepEqual(posts(orcamentos), ["'/api/orcamentos'", "`/api/orcamentos/${o.id}/transicao`"], "nenhum POST novo em Orçamentos");
});

test("Bloco 1/3 — Pedidos: orçamento de origem preenche nome, TELEFONE, descrição e valor; abre pela URL só para revisão", () => {
  const c = semComentarios(pedidosPagina);
  assert.match(c, /new URLSearchParams\(window\.location\.search\)\.get\('orcamento'\)/);
  assert.match(c, /setNomeCliente\(origem\.paciente_nome\); setTelefone\(origem\.telefone \? normalizar\(origem\.telefone\) : ''\);/);
  assert.match(c, /setLinhas\(\[\{ servicoId: AVULSO, descricaoManual: origem\.procedimento, valorManualReais: Number\(origem\.valor\)\.toFixed\(2\), quantidade: '1' \}\]\);/);
  assert.match(c, /setOrcamentoOrigem\(origem\); setAcompanharExecucao\(true\);\s*idempotencyKeyRef\.current = crypto\.randomUUID\(\);\s*setModalNovo\(true\);/);
  assert.match(c, /pedidosLidos\.some\(p => p\.orcamento_origem_id === idOrcamento\)[\s\S]*?Já existe uma venda registrada a partir deste orçamento\./);
  assert.match(c, /orcamento_origem_id: orcamentoOrigem\?\.id \|\| undefined,\s*acompanhar_execucao: acompanharExecucao \|\| undefined,/);
  // Serviços contratados não cadastra mais; o link antigo segue para a venda.
  assert.deepEqual(posts(tratamentos), [], "Serviços contratados é só histórico");
  assert.match(semComentarios(tratamentos), /router\.replace\(`\/pedidos\?orcamento=\$\{encodeURIComponent\(orcamentoDaUrl\)\}`\)/);
});

test("Bloco 2 — Cobrança: venda de origem preenche cliente cadastrado, nome, TELEFONE, descrição e valor", () => {
  const c = semComentarios(cobrancas);
  assert.match(c, /function dadosDaVenda\(v: VendaPicker, pacientes: ClientePicker\[\]\)[\s\S]*?pedidoId: v\.id,\s*pacienteId: v\.paciente_id && pacientes\.some\(p => p\.id === v\.paciente_id\) \? v\.paciente_id : '',\s*paciente_nome: v\.nome_cliente,\s*telefone: v\.telefone \? normalizar\(v\.telefone\) : '',\s*descricao: descricaoDaVenda\(v\),\s*valor: \(v\.valor_centavos \/ 100\)\.toFixed\(2\),/);
  assert.match(c, /new URLSearchParams\(window\.location\.search\)\.get\('pedido'\)/);
  assert.deepEqual(posts(cobrancas).filter(x => x === "'/api/cobrancas'"), ["'/api/cobrancas'"]);
});

test("Bloco 2 — Cobrança envia venda de origem, telefone e cliente nos campos que a API REALMENTE lê", () => {
  const c = semComentarios(cobrancas);
  const api = ler("app/api/cobrancas/route.ts");
  assert.match(api, /tratamento_origem_id, pedido_origem_id, descricao, valor,/);
  assert.match(c, /paciente_id: form\.pacienteId \|\| undefined,\s*paciente_nome: form\.paciente_nome\.trim\(\),\s*paciente_telefone: form\.telefone \? normalizar\(form\.telefone\) : undefined,\s*pedido_origem_id: form\.pedidoId \|\| undefined,/);
  assert.doesNotMatch(c, /^\s*telefone: form\.telefone/m, "chave que a API ignorava não existe mais");
});

test("Formulários do fluxo ficam contidos na área visível (mesma correção do Novo orçamento)", () => {
  for (const [nome, p] of [["oportunidades", oportunidades], ["cobrancas", cobrancas], ["orcamentos", orcamentos]]) {
    assert.match(p, /maxWidth: 480, maxHeight: '100%', boxSizing: 'border-box', overflowY: 'auto', overscrollBehavior: 'contain'/, nome);
    assert.doesNotMatch(p, /maxHeight: '90vh'/, nome);
  }
  assert.match(pedidosPagina, /maxWidth: 560, maxHeight: '100%', boxSizing: 'border-box', overflowY: 'auto', overscrollBehavior: 'contain'/, "Nova venda/pedido");
});

test("Telas do fluxo não mexem direto em estoque nem chamam RPC — isso é da API de pedidos", () => {
  for (const p of [orcamentos, oportunidades, tratamentos, cobrancas, ler("app/components/ItensCatalogoOrcamento.tsx")]) {
    assert.doesNotMatch(semComentarios(p), /\.rpc\(|estoque_|receita-perdida|follow-up-comercial|pesquisa-precos/);
  }
});
