import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
// Importa somente lógica pura: não inicializa Supabase nem chama o webhook.
const { classificarResposta } = require(path.join(buildDir, "zapi-classificar-resposta.js"));

test("Z-API: SIM, confirmações exatas, emojis e normalização preservados", () => {
  for (const texto of ["SIM", "s", " S ", "👍", "✅", "estarei lá", "ESTOU INDO", "pode confirmar", "confirmo", "confirmado", "ok", "certo", "  SÍM  ", "sim, estarei lá!"]) {
    assert.equal(classificarResposta(texto), "confirmar", texto);
  }
});

test("Z-API: NÃO/NAO, reagendamento e normalização preservados", () => {
  for (const texto of ["NÃO", "NAO", "na\u0303o", " n ", "cancelar", "cancela", "reagendar", "remarcar", "Não posso ir", "REAGENDAR, por favor", "não!"]) {
    assert.equal(classificarResposta(texto), "reagendar", texto);
  }
});

test("Z-API: mensagens sem comando continuam IGNORAR", () => {
  for (const texto of ["", "   ", "IGNORAR", "quanto custa limpeza?", "olá", "simples", "simplesmente", "naosei", "confirmados", "cancelamento", "okey", "👍👍", "s!", "n!", "estarei lá!", "pode confirmar agora", "talvez sim", "não: amanhã", "sim-amanhã"]) {
    assert.equal(classificarResposta(texto), "ignorar", texto);
  }
});

test("Z-API: prefixos respeitam os mesmos delimitadores e precedência", () => {
  for (const [prefixos, esperado] of [
    [["sim", "confirmo", "confirmado", "ok", "certo"], "confirmar"],
    [["nao", "cancelar", "cancela", "reagendar", "remarcar"], "reagendar"],
  ]) {
    for (const prefixo of prefixos) {
      for (const separador of [" ", "\t", "\n", ",", "!", ".", "?"]) {
        assert.equal(classificarResposta(`${prefixo}${separador}amanhã`), esperado);
      }
      assert.equal(classificarResposta(`${prefixo}xyz`), "ignorar");
    }
  }
  assert.equal(classificarResposta("sim, não"), "confirmar");
  assert.equal(classificarResposta("não, sim"), "reagendar");
});

test("Z-API: route.ts exporta somente GET e POST, sem helper público", () => {
  const file = path.join(root, "app/api/webhook/zapi/route.ts");
  const program = ts.createProgram([file], { noResolve: true, noLib: true });
  const checker = program.getTypeChecker();
  const symbol = checker.getSymbolAtLocation(program.getSourceFile(file));
  assert.deepEqual(checker.getExportsOfModule(symbol).map((item) => item.name).sort(), ["GET", "POST"]);
});

test("Z-API: rota consome o mesmo classificador testado, sem cópia local", () => {
  const file = path.join(root, "app/api/webhook/zapi/route.ts");
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find((node) => ts.isImportDeclaration(node) && node.moduleSpecifier.text === "../../../../lib/zapi-classificar-resposta");
  assert.ok(declaration);
  assert.ok(declaration.importClause.namedBindings.elements.some((item) => item.name.text === "classificarResposta" && !item.isTypeOnly));
  assert.ok(!source.statements.some((node) => ts.isFunctionDeclaration(node) && node.name?.text === "classificarResposta"));
  let calls = 0;
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "classificarResposta") {
      assert.equal(node.arguments.length, 1);
      assert.equal(node.arguments[0].getText(source), "mensagem");
      calls++;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(calls, 1);
});
