"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminShell from "../../components/AdminShell";
import SiteWorkspaceNav from "../SiteWorkspaceNav";
import {
  ICONES_CATALOGO, CORES_ICONE_CATALOGO, FORM_ITEM_VAZIO, formularioDoItem, salvarItemCatalogo, enviarImagemItem,
  type ItemCatalogo, type FormItemCatalogo,
} from "../../../lib/catalogo-comercial";

// Mesmo catálogo de Catálogo e Pedidos: a regra de persistência vive em
// lib/catalogo-comercial.ts (uma só); esta tela mantém a vitrine do site
// (ícone, ordem e exclusão).
type Item = ItemCatalogo;
type Form = FormItemCatalogo;
const ICONS = ICONES_CATALOGO;
const ICON_COLORS = CORES_ICONE_CATALOGO;

export default function ServicosAdmin() {
  const router = useRouter();
  const [clinicaId, setClinicaId] = useState("");
  const [itens, setItens]         = useState<Item[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState<{ mode:"add"|"edit"; item?: Item }|null>(null);
  const [form, setForm]           = useState<Form>({ ...FORM_ITEM_VAZIO });
  const [avisoPreco, setAvisoPreco] = useState("");
  const [uploading, setUploading] = useState(false);
  const [salvando, setSalvando]   = useState(false);
  const [erro, setErro]           = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.push("/login"); return; }
      const cuRes = await fetch("/api/minha-clinica", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const cid: string | undefined = cuRes.ok ? (await cuRes.json()).clinica_id : undefined;
      if (!cid) { return; }
      setClinicaId(cid);
      const { data } = await supabase.from("clinica_servicos").select("*").eq("clinica_id", cid).order("ordem");
      setItens(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  async function uploadImg(file: File) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !clinicaId) return;
    setUploading(true); setErro("");
    const r = await enviarImagemItem(session.access_token, clinicaId, file);
    setUploading(false);
    if (!r.ok) { setErro(r.erro); return; }
    setForm(p => ({ ...p, imagem_url: r.url }));
  }

  // Salvamento principal + preço/disponibilidade em chamada separada e
  // não-bloqueante — regra única em lib/catalogo-comercial.ts.
  async function salvar() {
    if (modal?.mode === "edit" && !modal.item) return;
    setSalvando(true); setErro("");
    const maxOrdem = itens.length ? Math.max(...itens.map(i => i.ordem)) + 1 : 0;
    const r = await salvarItemCatalogo(supabase, { clinicaId, form, itemId: modal?.mode === "edit" ? modal.item!.id : null, ordemNova: maxOrdem });
    if (!r.ok) { setErro(r.erro); setSalvando(false); return; }
    setAvisoPreco(r.avisoPreco);
    setSalvando(false); setModal(null); carregar();
  }

  async function excluir(id: string) {
    if (!window.confirm("Excluir este servico?")) return;
    await supabase.from("clinica_servicos").delete().eq("id", id).eq("clinica_id", clinicaId);
    carregar();
  }

  async function mover(item: Item, dir: -1|1) {
    const sorted = [...itens].sort((a,b) => a.ordem - b.ordem);
    const idx  = sorted.findIndex(i => i.id === item.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("clinica_servicos").update({ ordem: swap.ordem }).eq("id", item.id).eq("clinica_id", clinicaId),
      supabase.from("clinica_servicos").update({ ordem: item.ordem }).eq("id", swap.id).eq("clinica_id", clinicaId),
    ]);
    carregar();
  }

  const sorted = [...itens].sort((a,b) => a.ordem - b.ordem);
  const cor = (icone: string) => ICON_COLORS[icone] ?? "#00c896";

  return (
    <AdminShell title="Serviços" subtitle="Serviços exibidos no site" actionLabel="+ Adicionar Servico" actionOnClick={() => { setForm({ ...FORM_ITEM_VAZIO }); setModal({ mode:"add" }); setErro(""); }}>

      <SiteWorkspaceNav />

      {loading && <p style={{ color:"var(--muted)" }}>Carregando...</p>}

      {!loading && itens.length === 0 && (
        <div className="panel" style={{ textAlign:"center", padding:"52px 20px" }}>
          <div style={{ fontSize:44, marginBottom:14 }}>🛠️</div>
          <p style={{ color:"var(--muted)", margin:0, fontSize:15 }}>Nenhum servico cadastrado. Adicione seus servicos para exibir no site.</p>
        </div>
      )}

      {sorted.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:16 }}>
          {sorted.map((item, idx) => (
            <div key={item.id} style={{ background:"var(--surface)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, overflow:"hidden" }}>
              {item.imagem_url && (
                <div style={{ height:110, overflow:"hidden" }}>
                  <img src={item.imagem_url} alt={item.nome} style={{ width:"100%", height:"100%", objectFit:"cover" }} loading="lazy" />
                </div>
              )}
              <div style={{ padding:"14px 14px 10px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <div style={{ width:38, height:38, borderRadius:10, background:`${cor(item.icone)}20`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                    {ICONS.find(i => i.key === item.icone)?.emoji ?? "🛠️"}
                  </div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#f1f5f9" }}>{item.nome}</div>
                </div>
                {item.descricao && <p style={{ fontSize:12, color:"#64748b", lineHeight:1.6, margin:"0 0 10px" }}>{item.descricao}</p>}
                {typeof item.preco_centavos === "number" && item.preco_centavos > 0 && (
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                    <span style={{ fontSize:14, fontWeight:800, color:"#00c896" }}>{(item.preco_centavos/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span>
                    {item.disponivel === false && <span style={{ fontSize:10, fontWeight:700, color:"#f87171", background:"rgba(239,68,68,0.12)", padding:"2px 8px", borderRadius:20 }}>Indisponível</span>}
                  </div>
                )}
                <div style={{ display:"flex", gap:5 }}>
                  <button onClick={() => mover(item,-1)} disabled={idx===0} style={{ padding:"5px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#64748b", fontSize:12, cursor:"pointer" }}>↑</button>
                  <button onClick={() => mover(item, 1)} disabled={idx===sorted.length-1} style={{ padding:"5px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#64748b", fontSize:12, cursor:"pointer" }}>↓</button>
                  <button onClick={() => { setForm(formularioDoItem(item)); setModal({ mode:"edit", item }); setErro(""); setAvisoPreco(""); }} style={{ flex:1, padding:"5px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#94a3b8", fontSize:12, cursor:"pointer" }}>Editar</button>
                  <button onClick={() => excluir(item.id)} style={{ padding:"5px 8px", borderRadius:6, border:"1px solid rgba(239,68,68,0.3)", background:"transparent", color:"#f87171", fontSize:12, cursor:"pointer" }}>✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(6px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={() => setModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#0a0d14", border:"1px solid rgba(255,255,255,0.10)", borderRadius:20, padding:"28px 24px", maxWidth:480, width:"100%", maxHeight:"90vh", overflowY:"auto" }}>
            <h3 style={{ fontSize:17, fontWeight:700, color:"#f1f5f9", margin:"0 0 20px" }}>{modal.mode==="add" ? "Adicionar Servico" : "Editar Servico"}</h3>
            {erro && <div style={{ background:"rgba(239,68,68,0.10)", border:"1px solid rgba(239,68,68,0.3)", color:"#f87171", borderRadius:8, padding:"8px 12px", marginBottom:14, fontSize:13 }}>{erro}</div>}

            {/* Icone picker */}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:8 }}>Icone</label>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                {ICONS.map(ic => (
                  <button key={ic.key} type="button" onClick={() => setForm(p => ({...p, icone:ic.key}))}
                    style={{ padding:"10px 6px", borderRadius:10, border:`1.5px solid ${form.icone === ic.key ? cor(ic.key) : "rgba(255,255,255,0.08)"}`, background:form.icone === ic.key ? `${cor(ic.key)}18` : "rgba(255,255,255,0.02)", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    <span style={{ fontSize:20 }}>{ic.emoji}</span>
                    <span style={{ fontSize:10, color: form.icone === ic.key ? cor(ic.key) : "#64748b", fontWeight:600 }}>{ic.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Imagem opcional */}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:6 }}>Imagem ilustrativa (opcional)</label>
              <div onClick={() => fileRef.current?.click()} style={{ border:"2px dashed rgba(255,255,255,0.10)", borderRadius:10, height:100, overflow:"hidden", cursor:"pointer", position:"relative", display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(255,255,255,0.02)" }}>
                {form.imagem_url ? <img src={form.imagem_url} alt="preview" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <span style={{ fontSize:13, color:"#334155" }}>Clique para enviar imagem</span>}
                {uploading && <div style={{ position:"absolute", inset:0, background:"rgba(10,13,20,0.82)", display:"flex", alignItems:"center", justifyContent:"center", color:"#c4b5fd", fontSize:13 }}>Enviando...</div>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => e.target.files?.[0] && uploadImg(e.target.files[0])} />
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:6 }}>Nome do servico *</label>
              <input value={form.nome} onChange={e => setForm(p => ({...p, nome:e.target.value}))} placeholder="Ex: Corte de Cabelo, Consultoria Financeira..." className="input-field" />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:6 }}>Descricao</label>
              <textarea value={form.descricao} onChange={e => setForm(p => ({...p, descricao:e.target.value}))} placeholder="Descreva o que torna esse servico especial..." className="input-field" style={{ resize:"vertical", minHeight:70 }} />
            </div>

            {/* Preço/disponibilidade — E-commerce IA V1 (funcionalidade em ativação até a migration rodar) */}
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:6 }}>Preço (opcional — item sem preço continua exibido)</label>
              <input value={form.preco} onChange={e => setForm(p => ({...p, preco:e.target.value}))} placeholder="Ex: 150,00" className="input-field" />
            </div>
            <div style={{ marginBottom:22, display:"flex", alignItems:"center", gap:10 }}>
              <input type="checkbox" id="disponivel" checked={form.disponivel} onChange={e => setForm(p => ({...p, disponivel:e.target.checked}))} style={{ width:16, height:16 }} />
              <label htmlFor="disponivel" style={{ fontSize:13, color:"#94a3b8", cursor:"pointer" }}>Disponível para novos pedidos</label>
            </div>
            {avisoPreco && <div style={{ background:"rgba(251,191,36,0.10)", border:"1px solid rgba(251,191,36,0.3)", color:"#fbbf24", borderRadius:8, padding:"8px 12px", marginBottom:14, fontSize:12 }}>{avisoPreco}</div>}

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setModal(null)} className="button-secondary" style={{ flex:1, padding:12, fontSize:14 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando||uploading} className="button-primary" style={{ flex:2, padding:12, fontSize:14 }}>
                {salvando ? "Salvando..." : "Salvar Servico"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
