// Mesmo build CommonJS usado pelos testes de convergência.
// Para executar módulos server-only fora do Next: NODE_PATH deve incluir
// node_modules/next/dist/compiled e node_modules; execute node com
// --conditions=react-server (usa o marcador oficial empacotado pelo Next).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { builtinModules, createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const shared = require(path.join(buildDir, "google-business-profile-shared.js"));
const server = require(path.join(buildDir, "google-business-profile.js"));

// Analisa os imports de runtime após apagar tipos, incluindo reexports,
// import() e require(). Percorre os arquivos locais; pacotes são validados
// também pelo build Next, que aplica o marcador server-only.
function verificarClient(entry, read = (file) => fs.readFileSync(file, "utf8")) {
  const visited = new Set();
  function visit(file, chain = []) {
    if (visited.has(file)) return;
    visited.add(file);
    const source = read(file);
    const trail = [...chain, path.relative(root, file)].join(" -> ");
    assert.doesNotMatch(source, /process\.env\.GOOGLE_BUSINESS_PROFILE_/, `${trail}: GOOGLE_BUSINESS_PROFILE_ privado no client`);
    const js = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    for (const { fileName: specifier } of ts.preProcessFile(js, true, true).importedFiles) {
      assert.ok(specifier !== "server-only" && !specifier.startsWith("node:") && !builtinModules.includes(specifier), `${trail} -> ${specifier}`);
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) continue;
      const base = specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
      const resolved = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]
        .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      assert.ok(resolved, `Import local não resolvido: ${trail} -> ${specifier}`);
      if (/\.(?:[jt]sx?)$/.test(resolved)) visit(resolved, [...chain, path.relative(root, file)]);
    }
  }
  visit(entry);
  return visited;
}

test("Google Presença: grafo client não alcança server-only nem módulos Node", () => {
  const visited = verificarClient(path.join(root, "app/google-presenca/page.tsx"));
  assert.ok(visited.has(path.join(root, "lib/google-business-profile-shared.ts")));
  assert.ok(!visited.has(path.join(root, "lib/google-business-profile.ts")));
  assert.ok(!visited.has(path.join(root, "lib/google-business-profile-api.ts")));
});

test("guard de imports detecta a regressão original e reexport transitivo", () => {
  const page = path.join(root, "app/google-presenca/page.tsx");
  const sharedFile = path.join(root, "lib/google-business-profile-shared.ts");
  for (const broken of [page, sharedFile]) {
    assert.throws(() => verificarClient(page, (file) => {
      const source = fs.readFileSync(file, "utf8");
      if (file !== broken) return source;
      return file === page
        ? source.replace('from "../../lib/google-business-profile-shared"', 'from "../../lib/google-business-profile"')
        : source + '\nexport * from "./google-business-profile";';
    }), /server-only|node:crypto|GOOGLE_BUSINESS_PROFILE_/);
  }
});

test("OAuth, criptografia e I/O Google têm marcador server-only", () => {
  for (const file of ["lib/google-business-profile.ts", "lib/google-business-profile-api.ts"]) {
    const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), "utf8"), ts.ScriptTarget.Latest, true);
    assert.ok(source.statements.some((statement) => ts.isImportDeclaration(statement) && statement.moduleSpecifier.text === "server-only"), file);
  }
});

test("prompt compartilhado preserva contrato e reexport sem duplicar implementação", () => {
  assert.deepEqual(Object.keys(shared), ["montarPromptRespostaAvaliacao"]);
  assert.equal(server.montarPromptRespostaAvaliacao, shared.montarPromptRespostaAvaliacao);
  const result = shared.montarPromptRespostaAvaliacao({ nomeEmpresa: "Empresa Teste", nota: 2, comentario: "  Demorou  " });
  assert.equal(result, [
    'Escreva uma resposta profissional e cordial, em português do Brasil, para uma avaliação do Google recebida pela empresa "Empresa Teste".',
    'A nota dada foi 2 de 5 estrelas. O comentário do cliente foi: "Demorou"',
    "Regras obrigatórias: nunca invente detalhes sobre a compra, atendimento, entrega ou produto que não estejam no comentário acima.",
    "Nunca admita culpa ou responsabilidade jurídica. Nunca ofereça desconto, reembolso, indenização ou qualquer promessa.",
    "Se a nota for baixa, agradeça o retorno e convide a pessoa a entrar em contato diretamente para resolver, sem prometer nada específico.",
    "Responda só com o texto da resposta, sem aspas, sem explicações, com no máximo 3 frases.",
  ].join(" "));
  for (const comentario of [null, "", "   "]) {
    assert.match(shared.montarPromptRespostaAvaliacao({ nomeEmpresa: "Teste", nota: 5, comentario }), /O cliente não deixou comentário, só a nota\./);
  }
});

test("criptografia server preserva round-trip e rejeita chave/tag adulterados", () => {
  const secret = "fixture-local-google-boundary";
  const token = "fixture-refresh-token";
  const encrypted = server.cifrarRefreshToken(token, secret);
  assert.equal(server.decifrarRefreshToken(encrypted, secret), token);
  assert.notEqual(server.cifrarRefreshToken(token, secret), encrypted);
  assert.throws(() => server.decifrarRefreshToken(encrypted, "outra-chave-fixture"));
  const parts = encrypted.split(".");
  const tag = Buffer.from(parts[1], "base64url");
  tag[0] ^= 1;
  parts[1] = tag.toString("base64url");
  assert.throws(() => server.decifrarRefreshToken(parts.join("."), secret));
});

test("OAuth server preserva assinatura, expiração e nonce por tentativa", () => {
  const secret = "fixture-local-oauth-boundary";
  const state = server.criarEstadoGoogle("c1", "u1", secret, 1000);
  const decoded = server.validarEstadoGoogle(state, secret, 1001);
  assert.equal(decoded.clinicaId, "c1");
  assert.equal(decoded.userId, "u1");
  assert.equal(decoded.exp, 1600);
  assert.equal(server.validarEstadoGoogle(state, secret, 1601), null);
  assert.equal(server.validarEstadoGoogle(state, "outra-chave-fixture", 1001), null);
  assert.notEqual(server.criarEstadoGoogle("c1", "u1", secret, 1000), state);
});
