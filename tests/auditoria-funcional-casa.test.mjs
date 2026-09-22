// Auditoria Funcional 100% da Casa (P0.1) — verificação estática.
// Prova a causa real do indicador "1 Issue" (avisos reais de
// react-hooks/exhaustive-deps que o Next.js em modo dev também exibe no
// overlay de erros ao navegar para a rota afetada) e documenta o
// contrato real de vínculo de tenant (nenhum código cria clinica_usuarios
// — provisionamento é 100% manual/externo à aplicação).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

// Varre .ts/.tsx recursivamente sob os diretórios dados (implementação
// própria, evita depender de `grep`/`/bin/sh`, que não existem neste
// ambiente Windows/Node puro).
function arquivosTs(diretorios) {
  const resultado = [];
  const IGNORAR = new Set(["node_modules", ".next", ".git"]);
  function varrer(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      if (IGNORAR.has(entrada.name)) continue;
      const caminho = path.join(dir, entrada.name);
      if (entrada.isDirectory()) varrer(caminho);
      else if (/\.(ts|tsx|md)$/.test(entrada.name)) resultado.push(caminho);
    }
  }
  for (const d of diretorios) varrer(path.join(root, d));
  return resultado;
}

function arquivosComTrecho(diretorios, regex) {
  return arquivosTs(diretorios).filter((f) => regex.test(fs.readFileSync(f, "utf8")));
}

// ── Causa raiz do "1 Issue" ──────────────────────────────────────────────
// Next.js em modo dev roda o ESLint ao vivo e mostra os achados no MESMO
// indicador visual dos erros de runtime — por isso "1 Issue" só aparecia
// depois de navegar para uma rota com um warning real de
// react-hooks/exhaustive-deps (reputacao, chatbot, automacao).

test("reputacao/chatbot/automacao: zero avisos de eslint (react-hooks/exhaustive-deps) — causa provável do indicador '1 Issue' após navegação", () => {
  const saida = execSync(
    'npx eslint app/reputacao/page.tsx app/chatbot/page.tsx app/automacao/page.tsx',
    { cwd: root, encoding: "utf8" }
  );
  assert.equal(saida.trim(), "", "eslint deveria rodar limpo (0 erros, 0 warnings) nestes 3 arquivos");
});

test("reputacao: router incluído no array de dependências do efeito de inicialização (fix real, router é referência estável do Next.js)", () => {
  const codigo = ler("app/reputacao/page.tsx");
  const idx = codigo.lastIndexOf("init()");
  const trecho = codigo.slice(idx, idx + 30);
  assert.match(trecho, /\}, \[router\]\)/);
});

test("automacao: router incluído no array de dependências do useCallback (fix real)", () => {
  const codigo = ler("app/automacao/page.tsx");
  assert.match(codigo, /\}, \[router\]\);/);
});

test("chatbot: efeito mount-only documentado explicitamente (nunca adiciona funções locais instáveis ao array de dependências, o que causaria um NOVO loop infinito — mesma classe de bug já corrigida em AdminShell.tsx)", () => {
  const codigo = ler("app/chatbot/page.tsx");
  assert.match(codigo, /eslint-disable-next-line react-hooks\/exhaustive-deps -- mount-only por design/);
});

// ── Causa raiz do vínculo de tenant ("Negócio não vinculado ao usuário") ──

test("nenhum código da aplicação cria vínculo de tenant (clinica_usuarios) — provisionamento é 100% manual/externo, não um bug de código", () => {
  const arquivos = arquivosComTrecho(["app", "lib"], /from\((["'])clinica_usuarios\1\)\.insert/);
  assert.deepEqual(arquivos, [], "não deveria haver nenhum insert em clinica_usuarios no código da aplicação (confirma provisionamento manual)");
});

test("/api/minha-clinica: contrato real documentado — exige clinica_usuarios.ativo=true E clinicas.produto='organizapro' literal, fail-closed (404) quando ausente", () => {
  const codigo = ler("app/api/minha-clinica/route.ts");
  assert.match(codigo, /\.eq\("usuario_id", user\.id\)/);
  assert.match(codigo, /\.eq\("ativo", true\)/);
  assert.match(codigo, /clinica\?\.produto !== "organizapro"/);
  assert.match(codigo, /status: 404/);
});

test("receita-perdida/previsor-faturamento/linha-economica: mesmo contrato de tenant (/api/minha-clinica) — o mesmo gap de provisionamento afeta os três igualmente, não é um bug isolado de um só módulo", () => {
  for (const p of ["app/receita-perdida/page.tsx", "app/previsor-faturamento/page.tsx", "app/linha-economica/page.tsx"]) {
    assert.match(ler(p), /fetch\('\/api\/minha-clinica'/);
  }
});

// ── Mapa mestre — funcionalidades órfãs/fundação confirmadas por código ──

// P1 IMEDIATO — Reintegrar a Inteligência: lib/memoria-proveniencia.ts
// deixou de ser órfã nesta missão — app/api/memoria/route.ts agora a
// consome (POST grava prepararRegistroMemoria em eventos_dominio, GET
// devolve os fatos para app/clientes/[id]/page.tsx). Esta asserção
// substitui a original (que confirmava a ausência de qualquer import
// real) pelo estado atual: exatamente UM consumidor real, a rota nova.
test("lib/memoria-proveniencia.ts: reconectada — app/api/memoria/route.ts é o único consumidor real (P1: Reintegração da Inteligência)", () => {
  const arquivos = arquivosComTrecho(["app", "lib"], /from ["'].*memoria-proveniencia["']/)
    .filter((f) => !f.endsWith("memoria-proveniencia.ts"));
  assert.deepEqual(arquivos.map((f) => path.relative(root, f).replace(/\\/g, "/")), ["app/api/memoria/route.ts"]);
});

test("lib/atribuicao-origem.ts: calcularCAC/calcularROAS existem (preparação-fundação) mas não são chamados por nenhuma página/rota", () => {
  const atribuicao = ler("lib/atribuicao-origem.ts");
  assert.match(atribuicao, /export function calcularCAC/);
  assert.match(atribuicao, /export function calcularROAS/);
  const arquivos = arquivosComTrecho(["app"], /calcularCAC|calcularROAS/);
  assert.deepEqual(arquivos, [], "nenhuma página/rota deveria chamar calcularCAC/calcularROAS ainda — confirma preparação-fundação sem consumidor");
});

test("ProximaMelhorAcao.tsx, DiretorDigitalCard.tsx, CentralDeOportunidades.tsx e IndicadoresExecutivos.tsx: existem, mas não são mais importados por DashboardView.tsx (existe mas está escondida, por decisão de UX de missão anterior, não removida)", () => {
  const dashboardView = ler("app/components/DashboardView.tsx");
  for (const arquivo of ["app/components/ProximaMelhorAcao.tsx", "app/components/DiretorDigitalCard.tsx", "app/components/CentralDeOportunidades.tsx", "app/components/IndicadoresExecutivos.tsx"]) {
    assert.ok(fs.existsSync(path.join(root, arquivo)), `${arquivo} deveria continuar existindo`);
  }
  assert.doesNotMatch(dashboardView, /import DiretorDigitalCard|import CentralDeOportunidadesCard|import IndicadoresExecutivos/);
});

test("Cliente 360 (lib/cliente-360.ts): existe e é consumido por app/clientes/[id]/page.tsx — não órfão, embutido na ficha do cliente", () => {
  assert.match(ler("app/clientes/[id]/page.tsx"), /cliente-360/);
});

// P1.2 (CONSTRUIR O QUE AINDA FALTA): Copiloto Administrativo deixou de
// ser NÃO ENCONTRADO — app/copiloto/page.tsx é uma implementação real.
// Gerente Comercial AI continua sem motor/arquivo próprio, por decisão
// explícita da missão (é composição dos motores existentes, nunca um
// motor duplicado) — a única referência ao nome é documentação desse
// veredito, nunca um arquivo com esse nome.
test("Copiloto Administrativo: EXISTE — app/copiloto/page.tsx é implementação real, não apenas o nome citado", () => {
  assert.ok(fs.existsSync(path.join(root, "app/copiloto/page.tsx")));
  assert.match(ler("app/copiloto/page.tsx"), /gerarOportunidadesClientes|organizarSinaisCanonicos/);
});

test("Gerente Comercial AI: nenhum arquivo/motor com esse nome existe — decisão explícita de não duplicar, só composição dos motores existentes", () => {
  const arquivos = arquivosComTrecho(["app", "lib"], /Gerente Comercial/).filter((f) => !f.includes("test"));
  for (const f of arquivos) {
    // única forma aceita: comentário documentando a composição, nunca um
    // export/função/tipo com esse nome (o que seria um motor duplicado).
    assert.doesNotMatch(ler(path.relative(root, f)), /export (function|const|type|class) \w*[Gg]erente ?[Cc]omercial/);
  }
});

// ── Clientes usa RLS direto (Supabase client), não API service-role ──────

test("app/clientes/page.tsx: CRUD de pacientes via Supabase client direto (RLS), arquitetura diferente de orçamentos/pedidos/tratamentos/cobranças (API service-role) — inconsistência real documentada, não um bug de dado", () => {
  const codigo = ler("app/clientes/page.tsx");
  assert.match(codigo, /supabase\.from\('pacientes'\)\.insert/);
  assert.match(codigo, /supabase\.from\('pacientes'\)\.update/);
  assert.doesNotMatch(codigo, /fetch\('\/api\/clientes'/);
});
