"use client";

import { useState, useRef } from "react";
import type { DBServico } from "../_lib/types";
import { paleta, resolverFamilia, type Tema } from "../_lib/families";

// `tema` é opcional para o componente continuar utilizável isolado (testes,
// usos internos): no site publicado o orquestrador sempre passa o tema do
// modelo resolvido, para este bloco nunca destoar da identidade visual.
type Props = { slug: string; servicos: DBServico[]; codigoRastreio?: string; tema?: Tema };
type Quantidades = Record<string, number>;

function dinheiro(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PedidoPublico({ slug, servicos, codigoRastreio, tema = resolverFamilia(undefined) }: Props) {
  const tentativa = useRef<{ corpo: string; chave: string } | null>(null);
  const compraveis = servicos.filter((servico) => servico.disponivel !== false && typeof servico.preco_centavos === "number" && servico.preco_centavos > 0);
  const [quantidades, setQuantidades] = useState<Quantidades>({});
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);

  if (compraveis.length === 0) return null;
  const selecionados = compraveis.filter((servico) => (quantidades[servico.id] ?? 0) > 0);
  const total = selecionados.reduce((soma, servico) => soma + servico.preco_centavos! * quantidades[servico.id], 0);

  function alterarQuantidade(id: string, valor: number) {
    setQuantidades((atual) => ({ ...atual, [id]: Math.max(0, Math.min(99, valor || 0)) }));
    setMensagem(null);
  }

  async function enviarPedido(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (selecionados.length === 0) { setMensagem({ tipo: "erro", texto: "Escolha ao menos um item." }); return; }
    setEnviando(true); setMensagem(null);
    try {
      const corpo = JSON.stringify({ slug, nome_cliente: nome, telefone, observacao: observacao || null,
        itens: selecionados.map(s => ({ servico_id: s.id, quantidade: quantidades[s.id] })), codigo_rastreio: codigoRastreio });
      if (tentativa.current?.corpo !== corpo) tentativa.current = { corpo, chave: crypto.randomUUID() };
      const resposta = await fetch("/api/site-publico/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          codigo_rastreio: codigoRastreio,
          nome_cliente: nome,
          telefone,
          observacao: observacao || null,
          itens: selecionados.map((servico) => ({ servico_id: servico.id, quantidade: quantidades[servico.id] })),
          idempotency_key: tentativa.current!.chave,
        }),
      });
      const dados = await resposta.json() as { sucesso?: boolean; error?: string; pedido?: { id?: string } };
      if (!resposta.ok || !dados.sucesso) throw new Error(dados.error || "Não foi possível registrar seu pedido.");
      tentativa.current = null;
      setMensagem({ tipo: "sucesso", texto: `Pedido registrado com sucesso. Código: ${dados.pedido?.id?.slice(0, 8) ?? "confirmado"}.` });
      setQuantidades({}); setNome(""); setTelefone(""); setObservacao("");
    } catch (error) {
      setMensagem({ tipo: "erro", texto: error instanceof Error ? error.message : "Não foi possível registrar seu pedido." });
    } finally { setEnviando(false); }
  }

  // Este bloco nasceu no Site Premium 6.0 com uma paleta clara fixa (era
  // "Clínica Sorrisos"). Agora ele usa o tema do MODELO resolvido — mantendo o
  // polo claro, para o formulário continuar contrastando com o ritmo do site
  // nos três modelos. Nenhuma classe, campo ou regra de envio mudou.
  const p = paleta(tema, "light", 2);
  const fonte = { display: tema.fonteDisplay, corpo: tema.fonteCorpo };
  return <section id="pedido" className="public-order-section">
    <div className="public-order-shell">
      <div className="public-order-heading"><span>Pedido online</span><h2>Escolha o que você precisa</h2><p>Seu pedido será registrado para confirmação pela empresa. Não há pagamento online nesta etapa.</p></div>
      <form onSubmit={enviarPedido} className="public-order-layout">
        <div className="public-order-items">{compraveis.map((servico) => <article className="public-order-item" key={servico.id}>
          <div><h3>{servico.nome}</h3>{servico.descricao && <p>{servico.descricao}</p>}<strong>{dinheiro(servico.preco_centavos!)}</strong></div>
          <label>Quantidade<input type="number" min="0" max="99" value={quantidades[servico.id] ?? 0} onChange={(evento) => alterarQuantidade(servico.id, Number(evento.target.value))}/></label>
        </article>)}</div>
        <div className="public-order-form"><h3>Seus dados</h3><label>Nome<input required maxLength={160} value={nome} onChange={(evento) => setNome(evento.target.value)} /></label><label>Telefone<input required maxLength={40} value={telefone} onChange={(evento) => setTelefone(evento.target.value)} /></label><label>Observação (opcional)<textarea maxLength={500} value={observacao} onChange={(evento) => setObservacao(evento.target.value)} /></label><div className="public-order-total"><span>Total do pedido</span><strong>{dinheiro(total)}</strong></div><button type="submit" disabled={enviando}>{enviando ? "Registrando..." : "Enviar pedido"}</button>{mensagem && <p role="status" className={mensagem.tipo}>{mensagem.texto}</p>}</div>
      </form>
    </div>
    <style>{`.public-order-section{padding:96px 24px;background:var(--op-claro-fundo,${p.bg});color:var(--op-claro-texto,${p.text});font-family:var(--op-corpo,${fonte.corpo})}
    .public-order-shell{max-width:1180px;margin:0 auto}
    .public-order-heading{max-width:650px;margin-bottom:36px}
    .public-order-heading span{color:var(--op-claro-acento,${p.accent});font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
    .public-order-heading h2{margin:14px 0 10px;font-family:var(--op-display,${fonte.display});font-weight:600;font-size:clamp(28px,3.6vw,42px);line-height:1.12;text-wrap:balance}
    .public-order-heading p{margin:0;color:var(--op-claro-suave,${p.textMuted});line-height:1.7;overflow-wrap:anywhere}
    .public-order-layout{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,.8fr);gap:22px}
    .public-order-items,.public-order-form{display:grid;gap:12px;min-width:0}
    .public-order-item,.public-order-form{background:var(--op-claro-card,${p.card});border:1px solid var(--op-claro-linha,${p.line});border-radius:var(--op-raio,${tema.radius}px);padding:20px}
    .public-order-item{display:flex;justify-content:space-between;gap:20px;align-items:center}
    .public-order-item h3,.public-order-form h3{margin:0 0 7px;font-size:18px;font-family:var(--op-display,${fonte.display});font-weight:600;overflow-wrap:anywhere}
    .public-order-item p{margin:0 0 10px;color:var(--op-claro-suave,${p.textMuted});font-size:14px;line-height:1.5}
    .public-order-item strong{color:var(--op-claro-acento,${p.accent})}
    .public-order-item label,.public-order-form label{display:grid;gap:6px;color:var(--op-claro-suave,${p.textMuted});font-size:12px;font-weight:700}
    .public-order-item input{width:76px}
    .public-order-form input,.public-order-form textarea,.public-order-item input{box-sizing:border-box;border:1px solid var(--op-claro-linha,${p.line});border-radius:6px;padding:10px;background:var(--op-claro-fundo,${p.bg});color:var(--op-claro-texto,${p.text});font:inherit}
    .public-order-form textarea{min-height:86px;resize:vertical}
    .public-order-total{display:flex;justify-content:space-between;border-top:1px solid var(--op-claro-linha,${p.line});padding-top:15px;margin-top:4px;color:var(--op-claro-suave,${p.textMuted})}
    .public-order-total strong{color:var(--op-claro-texto,${p.text});font-size:21px}
    .public-order-form button{border:0;border-radius:6px;padding:13px;background:var(--op-primario,${tema.primaryDeep});color:#fff;font-weight:800;cursor:pointer;font-family:var(--op-corpo,${fonte.corpo})}
    .public-order-form button:disabled{opacity:.6;cursor:wait}
    .public-order-form p{margin:0;font-size:14px;line-height:1.5}
    .public-order-form p.sucesso{color:var(--op-claro-acento,${p.accent})}
    .public-order-form p.erro{color:#b3261e}
    @media(max-width:760px){.public-order-section{padding:74px 20px}.public-order-layout{grid-template-columns:1fr}.public-order-item{flex-direction:column;align-items:flex-start}}`}</style>
  </section>;
}
