"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, ClipboardCheck, ShieldAlert } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { NotaFacilOperacao } from "../../lib/notafacil-inteligente";
import AdminShell from "../components/AdminShell";

type Resposta = {
  operacoes?: NotaFacilOperacao[];
  aviso?: string;
  error?: string;
};

export default function NotaFacilPage() {
  const [operacoes, setOperacoes] = useState<NotaFacilOperacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: vinculo } = await supabase
        .from("clinica_usuarios")
        .select("clinica_id")
        .eq("usuario_id", session?.user.id ?? "")
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();

      if (!session || !vinculo?.clinica_id) {
        if (ativo) setErro("Sessão ou vínculo de clínica não encontrado.");
        setCarregando(false);
        return;
      }

      const resposta = await fetch(`/api/notafacil?clinica_id=${encodeURIComponent(vinculo.clinica_id)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const dados = await resposta.json() as Resposta;

      if (ativo) {
        if (!resposta.ok) setErro(dados.error ?? "Não foi possível carregar a preparação.");
        else setOperacoes(dados.operacoes ?? []);
        setCarregando(false);
      }
    }

    void carregar();
    return () => { ativo = false; };
  }, []);

  return (
    <AdminShell title="NotaFácil Inteligente" subtitle="Preparação de documento, nunca emissão fiscal">
    <div style={{ minHeight: "100%", background: "#f4f7f6", color: "#17231f", margin: "-28px -32px", padding: "32px 20px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <section style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "#fff8e8", border: "1px solid #f0d38a", borderRadius: 8, padding: 16, marginBottom: 22 }}>
          <ShieldAlert size={21} color="#9a6700" aria-hidden="true" />
          <div>
            <strong style={{ display: "block", color: "#765000", marginBottom: 4 }}>Preparação não é emissão fiscal</strong>
            <span style={{ color: "#765000", lineHeight: 1.5 }}>O OrganizaPro não emite NF-e ou NFS-e, não calcula tributos e não se conecta à prefeitura ou à SEFAZ nesta V1.</span>
          </div>
        </section>

        {carregando && <p style={{ color: "#53645d" }}>Consultando operações pagas...</p>}
        {erro && <p role="alert" style={{ color: "#a12b25" }}>{erro}</p>}
        {!carregando && !erro && operacoes.length === 0 && <EmptyState />}
        {!carregando && !erro && operacoes.length > 0 && (
          <section aria-labelledby="operacoes-pagas">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "end", marginBottom: 14 }}>
              <div>
                <p style={{ margin: 0, color: "#176b52", fontSize: 12, fontWeight: 800, letterSpacing: ".08em" }}>DADOS REAIS</p>
                <h2 id="operacoes-pagas" style={{ margin: "5px 0 0", fontSize: 21 }}>Operações pagas para preparar</h2>
              </div>
              <span style={{ color: "#53645d", fontSize: 14 }}>{operacoes.length} registro(s)</span>
            </div>
            <div style={{ display: "grid", gap: 12 }}>{operacoes.map((operacao) => <OperacaoCard key={operacao.id} operacao={operacao} />)}</div>
          </section>
        )}
      </div>
    </div>
    </AdminShell>
  );
}

function OperacaoCard({ operacao }: { operacao: NotaFacilOperacao }) {
  return (
    <article style={{ background: "#fff", border: "1px solid #d9e2dd", borderRadius: 8, padding: 18, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
        <div>
          <span style={{ color: operacao.status === "pronta_para_preparacao" ? "#176b52" : "#9a6700", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>
            {operacao.status === "pronta_para_preparacao" ? "Pronta para preparação" : "Pendente de informação"}
          </span>
          <h3 style={{ margin: "5px 0 0", fontSize: 19 }}>{operacao.descricao ?? "Descrição não informada"}</h3>
        </div>
        <ClipboardCheck size={22} color="#176b52" aria-hidden="true" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, color: "#34453e", fontSize: 14 }}>
        <Info label="Cliente" value={operacao.cliente ?? "Não identificado"} />
        <Info label="Valor pago" value={operacao.valor === null ? "Não informado" : `R$ ${operacao.valor.toFixed(2).replace(".", ",")}`} />
        <Info label="Data do pagamento" value={operacao.data ? new Date(operacao.data).toLocaleDateString("pt-BR") : "Não informada"} />
      </div>
      <div style={{ borderTop: "1px solid #e7eeea", paddingTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#765000", fontSize: 14, fontWeight: 700, marginBottom: 7 }}><AlertTriangle size={16} /> O que falta antes da emissão externa</div>
        <ul style={{ margin: 0, paddingLeft: 22, color: "#53645d", lineHeight: 1.6, fontSize: 14 }}>{operacao.pendencias.map((pendencia) => <li key={pendencia}>{pendencia}</li>)}</ul>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#176b52", fontSize: 13, fontWeight: 700 }}><ArrowRight size={16} /> Origem: cobrança paga</div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><span style={{ display: "block", color: "#718179", fontSize: 12, marginBottom: 3 }}>{label}</span><strong>{value}</strong></div>;
}

function EmptyState() {
  return <section style={{ background: "#fff", border: "1px solid #d9e2dd", borderRadius: 8, padding: 24, color: "#53645d" }}>Nenhuma cobrança paga encontrada para preparar.</section>;
}