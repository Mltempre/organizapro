"use client";

import { useState } from "react";
import type { DBServico } from "../_lib/types";

type Props = { slug: string; servicos: DBServico[] };

// ── Interesse Público — E-commerce IA V1 ─────────────────────────────────
//
// Complemento aditivo de PedidoPublico.tsx: aquele exige preço público
// (compraveis) e vira pedido direto; este cobre os serviços SEM preço
// público definido (sem sustento para gerar um pedido de valor) e
// qualquer visitante que queira só "pedir informações"/"solicitar
// orçamento" sem comprar. Nunca substitui o WhatsApp (Servicos.tsx
// continua com seu link), é uma segunda via estruturada que também vira
// sinal rastreável em public.oportunidades_demanda (canal "site"), sem
// nenhuma alteração em Servicos.tsx ou qualquer seção já homologada do
// Site Premium.
export default function InteressePublico({ slug, servicos }: Props) {
  const semPreco = servicos.filter((s) => s.disponivel !== false && !(typeof s.preco_centavos === "number" && s.preco_centavos > 0));
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [servicoNome, setServicoNome] = useState("");
  const [mensagem, setMensagemTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);

  if (semPreco.length === 0) return null;

  async function enviarInteresse(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!telefone.trim()) { setFeedback({ tipo: "erro", texto: "Informe um telefone para contato." }); return; }
    setEnviando(true); setFeedback(null);
    try {
      const resposta = await fetch("/api/site-publico/interesse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          nome: nome || null,
          telefone,
          servico_nome: servicoNome || null,
          mensagem: mensagem || null,
          idempotency_key: crypto.randomUUID(),
        }),
      });
      const dados = await resposta.json() as { sucesso?: boolean; error?: string };
      if (!resposta.ok || !dados.sucesso) throw new Error(dados.error || "Não foi possível registrar seu interesse.");
      setFeedback({ tipo: "sucesso", texto: "Recebemos seu contato — a empresa vai falar com você em breve." });
      setNome(""); setTelefone(""); setServicoNome(""); setMensagemTexto("");
    } catch (error) {
      setFeedback({ tipo: "erro", texto: error instanceof Error ? error.message : "Não foi possível registrar seu interesse." });
    } finally { setEnviando(false); }
  }

  return <section id="interesse" className="public-interest-section">
    <div className="public-interest-shell">
      <div className="public-interest-heading"><span>Solicitar informações</span><h2>Peça um orçamento ou tire uma dúvida</h2><p>Deixe seu contato que a empresa retorna diretamente com você.</p></div>
      <form onSubmit={enviarInteresse} className="public-interest-form">
        <label>Nome (opcional)<input maxLength={160} value={nome} onChange={(e) => setNome(e.target.value)} /></label>
        <label>Telefone<input required maxLength={40} value={telefone} onChange={(e) => setTelefone(e.target.value)} /></label>
        <label>Sobre qual serviço?<select value={servicoNome} onChange={(e) => setServicoNome(e.target.value)}>
          <option value="">Selecione (opcional)</option>
          {semPreco.map((s) => <option key={s.id} value={s.nome}>{s.nome}</option>)}
        </select></label>
        <label>Mensagem (opcional)<textarea maxLength={500} value={mensagem} onChange={(e) => setMensagemTexto(e.target.value)} /></label>
        <button type="submit" disabled={enviando}>{enviando ? "Enviando..." : "Solicitar contato"}</button>
        {feedback && <p role="status" className={feedback.tipo}>{feedback.texto}</p>}
      </form>
    </div>
    <style>{`.public-interest-section{padding:80px 24px;background:#fff}.public-interest-shell{max-width:680px;margin:0 auto}.public-interest-heading{margin-bottom:28px}.public-interest-heading span{color:#7b5b2e;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.public-interest-heading h2{margin:14px 0 10px;font-size:clamp(26px,3.2vw,36px);line-height:1.15;color:#1b2621}.public-interest-heading p{margin:0;color:#5d675f;line-height:1.7}.public-interest-form{display:grid;gap:14px;border:1px solid #ded8cd;border-radius:8px;padding:22px;background:#f7f3ec}.public-interest-form label{display:grid;gap:6px;color:#66736a;font-size:12px;font-weight:700}.public-interest-form input,.public-interest-form select,.public-interest-form textarea{box-sizing:border-box;border:1px solid #cfc8bc;border-radius:5px;padding:10px;background:#fff;color:#1b2621;font:inherit}.public-interest-form textarea{min-height:80px;resize:vertical}.public-interest-form button{border:0;border-radius:5px;padding:12px;background:#1b5e49;color:#fff;font-weight:800;cursor:pointer}.public-interest-form button:disabled{opacity:.6;cursor:wait}.public-interest-form p{margin:0;font-size:14px;line-height:1.5}.public-interest-form p.sucesso{color:#176b52}.public-interest-form p.erro{color:#a12b25}`}</style>
  </section>;
}
