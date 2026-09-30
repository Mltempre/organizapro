// removerAgregadosCobertosPorClientes — o agregado só sai quando os cards de
// cliente (pelo sinal principal que exibem) cobrem todos os seus casos.
// Mesmo build CommonJS dos testes de convergência (CONVERGENCIA_BUILD_DIR).
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const buildDir = process.env.CONVERGENCIA_BUILD_DIR;
if (!buildDir) throw new Error("CONVERGENCIA_BUILD_DIR não definido");
const { removerAgregadosCobertosPorClientes } = require(path.join(buildDir, "nucleo-inteligente.js"));

const rec = (id, quantidade) => ({ id, quantidade, categoria: "atencao", titulo: id, explicacao: "e", motivo: "m", acao: "a", destino: "/", destinoLabel: "d", prioridade: "alta", impacto: "i", tempoEstimado: "t" });
const sinal = (tipo, diasDesdeEvento = 0) => ({ tipo, motivo: "m", prioridade: "alta", acaoSugerida: "a", entidadeTipo: "agendamento", destino: "/", diasDesdeEvento, tempoDecorrido: null });
const cliente = (chave, ...sinais) => ({ chave, nome: chave, telefone: null, temTelefone: false, prioridade: "alta", motivoPrincipal: "m", acaoSugerida: "a", tempoDecorrido: null, sinaisAdicionais: sinais.length - 1, sinais });
const ids = (r) => r.map(x => x.id);

test("cancelamento de hoje coberto sai; cancelamento antigo não cobre o de hoje", () => {
  const recs = [rec("cancelamento-hoje", 1)];
  assert.deepEqual(ids(removerAgregadosCobertosPorClientes(recs, [cliente("a", sinal("cancelamento_sem_reagendamento", 0))])), []);
  assert.deepEqual(ids(removerAgregadosCobertosPorClientes(recs, [cliente("a", sinal("cancelamento_sem_reagendamento", 12))])), ["cancelamento-hoje"]);
});

test("fato escondido como sinal adicional não conta como coberto", () => {
  const recs = [rec("confirmacao-pendente-hoje", 1)];
  const principalOutro = cliente("a", sinal("orcamento_parado", 5), sinal("confirmacao_pendente", 0));
  assert.deepEqual(ids(removerAgregadosCobertosPorClientes(recs, [principalOutro])), ["confirmacao-pendente-hoje"]);
});

test("dois compromissos do mesmo cliente contam como dois casos visíveis", () => {
  const recs = [rec("confirmacao-pendente-hoje", 2)];
  const doisNoMesmo = cliente("a", sinal("confirmacao_pendente", 0), sinal("confirmacao_pendente", 0));
  assert.deepEqual(ids(removerAgregadosCobertosPorClientes(recs, [doisNoMesmo])), []);
});

test("recomendações sem equivalente por cliente nunca são removidas", () => {
  const recs = ["compromissos-atrasados", "horario-vago-hoje", "avaliacao-pendente", "perfil-incompleto", "whatsapp-nao-configurado"].map(id => rec(id, 1));
  assert.deepEqual(ids(removerAgregadosCobertosPorClientes(recs, [cliente("a", sinal("confirmacao_pendente", 0))])), ids(recs));
});
