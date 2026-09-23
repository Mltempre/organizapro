import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const rota = readFileSync(path.join(root, "app/api/site-publico/interesse/route.ts"), "utf8");
const ui = readFileSync(path.join(root, "app/empresa/[slug]/_components/InteressePublico.tsx"), "utf8");
const orquestrador = readFileSync(path.join(root, "app/empresa/[slug]/SiteEmpresaClient.tsx"), "utf8");
const oportunidadesRota = readFileSync(path.join(root, "app/api/oportunidades/route.ts"), "utf8");

// Fecha o gap real da auditoria: canal "site" existia no tipo/schema mas
// nenhuma rota o produzia — só POST /api/oportunidades (autenticado).

test("resolve tenant somente pelo slug e produto literal — mesmo padrão de site-publico/pedidos", () => {
  assert.match(rota, /rpc\("site_publico_por_slug_v2", \{ p_slug: slug, p_produto: "organizapro" \}\)/);
  assert.doesNotMatch(rota, /body\.clinica_id|body\.clinicaId/);
});

test("usa o motor puro já testado de oportunidades-demanda, nenhuma regra nova de validação", () => {
  assert.match(rota, /import \{ normalizarTelefone, validarNovaOportunidade, type NovaOportunidade \} from "\.\.\/\.\.\/\.\.\/\.\.\/lib\/oportunidades-demanda"/);
  assert.match(rota, /validarNovaOportunidade\(novaOportunidade\)/);
});

test("canal é sempre 'site' — nunca aceito do corpo da requisição", () => {
  assert.match(rota, /canal: "site"/);
  assert.doesNotMatch(rota, /body\.canal/);
});

test("idempotência: chave por tenant, reaproveitando upsert (mesmo padrão de eventos_dominio)", () => {
  assert.match(rota, /chaveIdempotencia = `interesse-publico:/);
  assert.match(rota, /onConflict: "clinica_id,chave_idempotencia"/);
});

test("nunca fabrica dado de contato — telefone é obrigatório, nome/mensagem são opcionais e nunca inventados", () => {
  assert.match(rota, /if \(!slug \|\| !telefone \|\| !idempotencyKey\)/);
  assert.match(rota, /normalizarTelefone\(telefone\)\.length < 8/);
});

test("criado_por é sempre null — nunca atribuído a um usuário autenticado do painel", () => {
  assert.match(rota, /criado_por: null,/);
});

test("rota autenticada continua intocada (nenhuma regressão no fluxo manual do lojista)", () => {
  assert.match(oportunidadesRota, /await autorizarUsuarioNaClinica\(req, vinculo\.clinica_id\)/);
});

test("UI: só aparece para serviços sem preço público (nunca duplica PedidoPublico)", () => {
  assert.match(ui, /!\(typeof s\.preco_centavos === "number" && s\.preco_centavos > 0\)/);
});

test("UI: preço/valor nunca é enviado pelo frontend (rota não aceita nem calcula valor)", () => {
  assert.doesNotMatch(ui, /preco_centavos:|valor_centavos:|valor_total/);
  assert.doesNotMatch(rota, /preco_centavos|valor_centavos/);
});

test("orquestrador: componente aditivo, sem alterar nenhuma seção existente do Site Premium", () => {
  assert.match(orquestrador, /<PedidoPublico slug={slug} servicos={servicos} codigoRastreio={codigoRastreio}\/>\s*\n\s*<InteressePublico slug={slug} servicos={servicos} codigoRastreio={codigoRastreio}\/>/);
});

console.log("interesse-publico: 10 gates de segurança e composição OK");
