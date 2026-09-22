// P1.3 — Missão 2 (Google/Meta Ads + Atribuição) e Missão 3 (Prova de
// Resultado do Gerente Comercial).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const { agregarAtribuicao } = await import(pathToFileURL(path.join(buildDir, "atribuicao-relatorio.js")));

// ── Missão 2: agregarAtribuicao (motor puro) ─────────────────────────────

test("zero capturas nunca fabrica linha nenhuma", () => {
  assert.deepEqual(agregarAtribuicao([], {}), []);
});

test("captura sem vínculo (paciente_id null) conta em totalCapturas mas nunca em totalVinculados/receita — nunca infere atribuição", () => {
  const r = agregarAtribuicao([{ classificacao: "google_ads", pacienteId: null }], {});
  assert.equal(r.length, 1);
  assert.equal(r[0].totalCapturas, 1);
  assert.equal(r[0].totalVinculados, 0);
  assert.equal(r[0].receitaComprovadaCentavos, 0);
});

test("vínculo comprovado sem receita ainda: conta em totalVinculados, mas receita continua 0 (nunca estima)", () => {
  const r = agregarAtribuicao([{ classificacao: "meta_ads", pacienteId: "pac-1" }], {});
  assert.equal(r[0].totalVinculados, 1);
  assert.equal(r[0].receitaComprovadaCentavos, 0);
});

test("receita comprovada soma exatamente o que foi passado por paciente vinculado — nunca um valor a mais/menos", () => {
  const r = agregarAtribuicao(
    [{ classificacao: "google_ads", pacienteId: "pac-1" }, { classificacao: "google_ads", pacienteId: "pac-2" }],
    { "pac-1": 10000, "pac-2": 5000 }
  );
  assert.equal(r[0].receitaComprovadaCentavos, 15000);
  assert.equal(r[0].totalComReceitaComprovada, 2);
});

test("CAC/ROAS SEMPRE null nesta versão — nenhuma integração real de gasto de mídia (custoCentavos é sempre null, nunca fabricado)", () => {
  const r = agregarAtribuicao([{ classificacao: "google_ads", pacienteId: "pac-1" }], { "pac-1": 50000 });
  assert.equal(r[0].custoCentavos, null);
  assert.equal(r[0].cac, null);
  assert.equal(r[0].roas, null);
});

test("classificações sem nenhuma captura real nunca aparecem no relatório (nunca preenche com zero fabricado)", () => {
  const r = agregarAtribuicao([{ classificacao: "google_ads", pacienteId: null }], {});
  const classificacoes = r.map((l) => l.classificacao);
  assert.deepEqual(classificacoes, ["google_ads"]);
});

// ── Missão 2: arquitetura (migration preparada, rota, página) ────────────

test("sql/atribuicao-origem-fase1.sql: PREPARADA, nunca executada nesta missão — cria exatamente a tabela que lib/origem-persistencia.ts já espera", () => {
  const sql = ler("sql/atribuicao-origem-fase1.sql");
  assert.match(sql, /PREPARADA, NÃO EXECUTADA/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.origem_captacoes/);
  for (const coluna of ["clinica_id", "utm_source", "gclid", "fbclid", "classificacao", "codigo_rastreio", "capturado_em", "paciente_id", "vinculado_em"]) {
    assert.match(sql, new RegExp(coluna), `coluna ${coluna} deveria estar na migration (usada por lib/origem-persistencia.ts)`);
  }
});

test("GET /api/atribuicao: erro de tabela ausente nunca vira 500 nem fabrica dado — devolve indisponivel:true (mesmo padrão de /api/atividade-recente)", () => {
  const codigo = ler("app/api/atribuicao/route.ts");
  assert.match(codigo, /indisponivel: true, motivo: error\.message, origens: \[\]/);
});

test("Atribuição: página distingue explicitamente Google Ads/Meta Ads de Google Presença (nunca confunde os dois domínios)", () => {
  const codigo = ler("app/atribuicao/page.tsx");
  assert.match(codigo, /Google Presença/);
  assert.match(codigo, /não confundir/i);
});

test("Atribuição: CAC/ROAS renderizados como '—' quando null, nunca '0' ou 'R$ 0,00' (que pareceria um fato medido)", () => {
  const codigo = ler("app/atribuicao/page.tsx");
  assert.match(codigo, /l\.cac !== null \? formatarValor\(l\.cac\) : '—'/);
  assert.match(codigo, /l\.roas !== null \? l\.roas\.toFixed\(2\) : '—'/);
});

test("Atribuição: item de navegação real em Inteligência", () => {
  const adminShellFrame = ler("app/components/AdminShellFrame.tsx");
  assert.match(adminShellFrame, /h: "\/atribuicao"/);
});

// ── Missão 3: SINAL → RECOMENDAÇÃO → AÇÃO → RESULTADO ────────────────────

test("registrarResultadoSeHouveDecisao: nunca lança, nunca bloqueia a transição real (fail-safe by design)", () => {
  const codigo = ler("lib/auditoria-resultado-persistencia.ts");
  assert.match(codigo, /try \{/);
  assert.match(codigo, /catch \(e\)/);
});

test("registrarResultadoSeHouveDecisao: só vincula quando já existe uma auditoria.decisao real para a MESMA entidade — nunca infere/adivinha a decisão de origem", () => {
  const codigo = ler("lib/auditoria-resultado-persistencia.ts");
  assert.match(codigo, /eq\("tipo", "auditoria\.decisao"\)/);
  assert.match(codigo, /eq\("entidade_id", params\.entidadeId\)/);
  assert.match(codigo, /if \(erroBusca \|\| !decisao\) return;/);
});

test("registrarResultadoSeHouveDecisao: delega ao motor puro prepararVinculoResultado — nunca reimplementa a regra de idempotência/payload", () => {
  const codigo = ler("lib/auditoria-resultado-persistencia.ts");
  assert.match(codigo, /import \{ prepararVinculoResultado \} from "\.\/auditoria-decisoes"/);
  assert.match(codigo, /prepararVinculoResultado\(/);
});

test("wiring real: orçamentos, pedidos e tratamentos chamam registrarResultadoSeHouveDecisao após a transição real (nunca antes, nunca sem a transição ter sido confirmada)", () => {
  for (const [arquivo, entidade] of [
    ["app/api/orcamentos/[id]/transicao/route.ts", "orcamento"],
    ["app/api/pedidos/[id]/transicao/route.ts", "pedido"],
    ["app/api/tratamentos/[id]/transicao/route.ts", "tratamento"],
  ]) {
    const codigo = ler(arquivo);
    assert.match(codigo, /registrarResultadoSeHouveDecisao/, `${arquivo} deveria chamar o vínculo de resultado`);
    const idxEvento = codigo.indexOf("eventos_dominio\").insert");
    const idxResultado = codigo.indexOf("registrarResultadoSeHouveDecisao(admin");
    assert.ok(idxResultado > idxEvento, `${arquivo}: resultado deveria ser registrado DEPOIS do evento de transição real, nunca antes`);
    assert.match(codigo, new RegExp(`entidadeTipo: "${entidade}"`));
  }
});

test("/api/memoria GET: auditoria.resultado_posterior é encontrada via decisao_origem_chave (nunca via cliente_id, que o payload nunca duplica)", () => {
  const codigo = ler("app/api/memoria/route.ts");
  assert.match(codigo, /payload->>decisao_origem_chave/);
  assert.doesNotMatch(codigo, /"auditoria\.decisao", "auditoria\.resultado_posterior"\]\)\s*\n\s*\.eq\("payload->>cliente_id"/, "resultado_posterior nunca deveria ser buscado pelo mesmo filtro de cliente_id que auditoria.decisao usa");
});

// Atualizado — Convergência dos Amarelos/Órfãos: o gap era real (a
// transição vive numa RPC, não numa rota [id]/transicao comum), mas o
// caminho para fechá-lo sem migration existia — a RPC já devolve a linha
// completa (to_jsonb(atual)), incluindo o telefone, então o mesmo uuid
// determinístico usado para gravar a auditoria.decisao de
// oportunidade_parada (entidadeTipo "cliente", nunca o id da linha —
// ver app/api/follow-up/tentativa/route.ts) pode ser recalculado em
// código de aplicação para achar a decisão certa. Zero migration, zero
// causalidade fabricada (prepararVinculoResultado continua gravando
// prova_causalidade:false).
test("Gerente Comercial: oportunidades (RPC transicionar_oportunidade_demanda_v1) agora chama registrarResultadoSeHouveDecisao em código de aplicação, usando o telefone que a RPC devolve — sem migration na função", () => {
  const codigo = ler("app/api/oportunidades/[id]/transicao/route.ts");
  assert.match(codigo, /registrarResultadoSeHouveDecisao\(supabase/);
  assert.match(codigo, /entidadeIdDeTelefone\(auth\.clinicaId, telefoneOportunidade\)/);
  assert.match(codigo, /entidadeTipo: "cliente"/);
  const idxRpc = codigo.indexOf('supabase.rpc("transicionar_oportunidade_demanda_v1"');
  const idxResultado = codigo.indexOf("registrarResultadoSeHouveDecisao(supabase");
  assert.ok(idxResultado > idxRpc, "resultado deveria ser registrado DEPOIS da RPC ter transicionado de verdade, nunca antes");
});

test("vínculo de resultado da oportunidade é best-effort e condicional a telefone real — nunca bloqueia a resposta da transição nem fabrica cliente", () => {
  const codigo = ler("app/api/oportunidades/[id]/transicao/route.ts");
  const idxIf = codigo.indexOf("if (telefoneOportunidade) {");
  const idxReturn = codigo.indexOf("return NextResponse.json({ data });");
  assert.ok(idxIf > -1 && idxReturn > idxIf, "o registro de resultado deveria estar condicionado a telefone real e antes do return final, sem impedir a resposta");
});
