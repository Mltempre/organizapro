"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminShell from "../../components/AdminShell";
import SiteWorkspaceNav from "../SiteWorkspaceNav";

type Item = { id: string; pergunta: string; resposta: string; ordem: number };
type Form = { pergunta: string; resposta: string };


export default function FaqAdmin() {
  const router = useRouter();
  const [clinicaId, setClinicaId] = useState("");
  const [itens, setItens]         = useState<Item[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState<{ mode:"add"|"edit"; item?: Item }|null>(null);
  const [form, setForm]           = useState<Form>({ pergunta:"", resposta:"" });
  const [salvando, setSalvando]   = useState(false);
  const [erro, setErro]           = useState("");

  const carregar = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: cu } = await supabase.from("clinica_usuarios").select("clinica_id").eq("usuario_id", user.id).maybeSingle();
      if (!cu?.clinica_id) { return; }
      setClinicaId(cu.clinica_id);
      const { data } = await supabase.from("clinica_faq").select("*").eq("clinica_id", cu.clinica_id).order("ordem");
      setItens(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  async function salvar() {
    if (!form.pergunta.trim()) { setErro("Informe a pergunta."); return; }
    if (!form.resposta.trim()) { setErro("Informe a resposta."); return; }
    setSalvando(true); setErro("");
    const payload = { clinica_id: clinicaId, pergunta: form.pergunta.trim(), resposta: form.resposta.trim() };
    if (modal?.mode === "add") {
      const maxOrdem = itens.length ? Math.max(...itens.map(i => i.ordem)) + 1 : 0;
      const { error } = await supabase.from("clinica_faq").insert({ ...payload, ordem: maxOrdem });
      if (error) { setErro("Erro ao salvar."); setSalvando(false); return; }
    } else if (modal?.item) {
      const { error } = await supabase.from("clinica_faq").update(payload).eq("id", modal.item.id);
      if (error) { setErro("Erro ao salvar."); setSalvando(false); return; }
    }
    setSalvando(false); setModal(null); carregar();
  }

  async function excluir(id: string) {
    if (!window.confirm("Excluir esta pergunta?")) return;
    await supabase.from("clinica_faq").delete().eq("id", id);
    carregar();
  }

  async function mover(item: Item, dir: -1|1) {
    const sorted = [...itens].sort((a,b) => a.ordem - b.ordem);
    const idx  = sorted.findIndex(i => i.id === item.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("clinica_faq").update({ ordem: swap.ordem }).eq("id", item.id),
      supabase.from("clinica_faq").update({ ordem: item.ordem }).eq("id", swap.id),
    ]);
    carregar();
  }

  const sorted = [...itens].sort((a,b) => a.ordem - b.ordem);

  return (
    <AdminShell title="FAQ" subtitle="Perguntas frequentes exibidas no site" actionLabel="+ Adicionar Pergunta" actionOnClick={() => { setForm({ pergunta:"", resposta:"" }); setModal({ mode:"add" }); setErro(""); }}>

      <SiteWorkspaceNav />

      {loading && <p style={{ color:"var(--muted)" }}>Carregando...</p>}

      {!loading && itens.length === 0 && (
        <div className="panel" style={{ textAlign:"center", padding:"52px 20px" }}>
          <div style={{ fontSize:44, marginBottom:14 }}>❓</div>
          <p style={{ color:"var(--muted)", margin:0, fontSize:15 }}>Nenhuma pergunta cadastrada. Adicione as dúvidas mais comuns dos seus clientes.</p>
        </div>
      )}

      {sorted.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {sorted.map((item, idx) => (
            <div key={item.id} style={{ background:"var(--surface)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, padding:"18px 20px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:16, marginBottom:10 }}>
                <div style={{ fontSize:14.5, fontWeight:700, color:"#f1f5f9", flex:1 }}>{item.pergunta}</div>
                <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                  <button onClick={() => mover(item,-1)} disabled={idx===0} style={{ padding:"5px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#64748b", fontSize:12, cursor:"pointer" }}>↑</button>
                  <button onClick={() => mover(item, 1)} disabled={idx===sorted.length-1} style={{ padding:"5px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#64748b", fontSize:12, cursor:"pointer" }}>↓</button>
                  <button onClick={() => { setForm({ pergunta:item.pergunta, resposta:item.resposta }); setModal({ mode:"edit", item }); setErro(""); }} style={{ padding:"5px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#94a3b8", fontSize:12, cursor:"pointer" }}>Editar</button>
                  <button onClick={() => excluir(item.id)} style={{ padding:"5px 8px", borderRadius:6, border:"1px solid rgba(239,68,68,0.3)", background:"transparent", color:"#f87171", fontSize:12, cursor:"pointer" }}>✕</button>
                </div>
              </div>
              <p style={{ fontSize:13, color:"rgba(255,255,255,0.65)", lineHeight:1.65, margin:0 }}>{item.resposta}</p>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(6px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={() => setModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#0a0d14", border:"1px solid rgba(255,255,255,0.10)", borderRadius:20, padding:"28px 24px", maxWidth:480, width:"100%", maxHeight:"90vh", overflowY:"auto" }}>
            <h3 style={{ fontSize:17, fontWeight:700, color:"#f1f5f9", margin:"0 0 20px" }}>{modal.mode==="add" ? "Adicionar Pergunta" : "Editar Pergunta"}</h3>
            {erro && <div style={{ background:"rgba(239,68,68,0.10)", border:"1px solid rgba(239,68,68,0.3)", color:"#f87171", borderRadius:8, padding:"8px 12px", marginBottom:14, fontSize:13 }}>{erro}</div>}

            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:6 }}>Pergunta *</label>
              <input value={form.pergunta} onChange={e => setForm(p => ({...p, pergunta:e.target.value}))} placeholder="Como funciona o primeiro atendimento?" className="input-field" />
            </div>

            <div style={{ marginBottom:22 }}>
              <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:6 }}>Resposta *</label>
              <textarea value={form.resposta} onChange={e => setForm(p => ({...p, resposta:e.target.value}))} placeholder="Explique de forma clara e objetiva..." className="input-field" style={{ resize:"vertical", minHeight:100 }} />
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setModal(null)} className="button-secondary" style={{ flex:1, padding:12, fontSize:14 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="button-primary" style={{ flex:2, padding:12, fontSize:14 }}>
                {salvando ? "Salvando..." : "Salvar Pergunta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
