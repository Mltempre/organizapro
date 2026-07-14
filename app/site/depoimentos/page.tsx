"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminShell from "../../components/AdminShell";
import SiteWorkspaceNav from "../SiteWorkspaceNav";

type Item = { id: string; nome: string; cidade: string|null; comentario: string; nota: number; foto_url: string|null; ordem: number; };
type Form = { nome: string; cidade: string; comentario: string; nota: number; foto_url: string; };


const AVATAR_COLORS = ["#00c896","#3b82f6","#8b5cf6","#f59e0b","#ef4444","#06b6d4"];
const initials = (nome: string) => nome.trim().split(" ").filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 2).join("");

export default function DepoimentosAdmin() {
  const router = useRouter();
  const [clinicaId, setClinicaId] = useState("");
  const [itens, setItens]         = useState<Item[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState<{ mode:"add"|"edit"; item?: Item }|null>(null);
  const [form, setForm]           = useState<Form>({ nome:"", cidade:"", comentario:"", nota:5, foto_url:"" });
  const [uploading, setUploading] = useState(false);
  const [salvando, setSalvando]   = useState(false);
  const [erro, setErro]           = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: cu } = await supabase.from("clinica_usuarios").select("clinica_id").eq("usuario_id", user.id).maybeSingle();
      if (!cu?.clinica_id) { return; }
      setClinicaId(cu.clinica_id);
      const { data } = await supabase.from("clinica_depoimentos").select("*").eq("clinica_id", cu.clinica_id).order("ordem");
      setItens(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  async function uploadFoto(file: File) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !clinicaId) return;
    setUploading(true); setErro("");
    const fd = new FormData();
    fd.append("file", file); fd.append("tipo", "depoimento"); fd.append("clinica_id", clinicaId);
    const res  = await fetch("/api/upload", { method:"POST", headers:{ Authorization:`Bearer ${session.access_token}` }, body:fd });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) { setErro(data.error || "Erro no upload."); return; }
    setForm(p => ({ ...p, foto_url: data.url }));
  }

  async function salvar() {
    if (!form.nome.trim()) { setErro("Informe o nome do cliente."); return; }
    if (!form.comentario.trim()) { setErro("Informe o comentario."); return; }
    setSalvando(true); setErro("");
    const payload = { clinica_id:clinicaId, nome:form.nome.trim(), cidade:form.cidade.trim()||null, comentario:form.comentario.trim(), nota:form.nota, foto_url:form.foto_url||null };
    if (modal?.mode === "add") {
      const maxOrdem = itens.length ? Math.max(...itens.map(i => i.ordem)) + 1 : 0;
      const { error } = await supabase.from("clinica_depoimentos").insert({ ...payload, ordem:maxOrdem });
      if (error) { setErro("Erro ao salvar."); setSalvando(false); return; }
    } else if (modal?.item) {
      const { error } = await supabase.from("clinica_depoimentos").update(payload).eq("id", modal.item.id);
      if (error) { setErro("Erro ao salvar."); setSalvando(false); return; }
    }
    setSalvando(false); setModal(null); carregar();
  }

  async function excluir(id: string) {
    if (!window.confirm("Excluir este depoimento?")) return;
    await supabase.from("clinica_depoimentos").delete().eq("id", id);
    carregar();
  }

  async function mover(item: Item, dir: -1|1) {
    const sorted = [...itens].sort((a,b) => a.ordem - b.ordem);
    const idx  = sorted.findIndex(i => i.id === item.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("clinica_depoimentos").update({ ordem: swap.ordem }).eq("id", item.id),
      supabase.from("clinica_depoimentos").update({ ordem: item.ordem }).eq("id", swap.id),
    ]);
    carregar();
  }

  const sorted = [...itens].sort((a,b) => a.ordem - b.ordem);

  return (
    <AdminShell title="Depoimentos" subtitle="Avaliacoes de clientes exibidas no site" actionLabel="+ Adicionar Depoimento" actionOnClick={() => { setForm({ nome:"", cidade:"", comentario:"", nota:5, foto_url:"" }); setModal({ mode:"add" }); setErro(""); }}>

      <SiteWorkspaceNav />

      {loading && <p style={{ color:"var(--muted)" }}>Carregando...</p>}

      {!loading && itens.length === 0 && (
        <div className="panel" style={{ textAlign:"center", padding:"52px 20px" }}>
          <div style={{ fontSize:44, marginBottom:14 }}>💬</div>
          <p style={{ color:"var(--muted)", margin:0, fontSize:15 }}>Nenhum depoimento cadastrado. Adicione avaliacoes para aumentar a confianca.</p>
        </div>
      )}

      {sorted.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:16 }}>
          {sorted.map((item, idx) => (
            <div key={item.id} style={{ background:"var(--surface)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, padding:"16px 16px 12px" }}>
              <div style={{ display:"flex", gap:3, marginBottom:10 }}>
                {[1,2,3,4,5].map(s => <span key={s} style={{ color: s <= item.nota ? "#f59e0b" : "#334155", fontSize:14 }}>★</span>)}
                <span style={{ fontSize:11, color:"#64748b", marginLeft:4 }}>{item.nota}/5</span>
              </div>
              <p style={{ fontSize:13, color:"rgba(255,255,255,0.65)", lineHeight:1.65, margin:"0 0 14px", display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical" as const, overflow:"hidden", fontStyle:"italic" }}>
                &ldquo;{item.comentario}&rdquo;
              </p>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                {item.foto_url
                  ? <img src={item.foto_url} alt={item.nome} style={{ width:36, height:36, borderRadius:"50%", objectFit:"cover" }} />
                  : <div style={{ width:36, height:36, borderRadius:"50%", background:AVATAR_COLORS[idx % AVATAR_COLORS.length], display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:"#fff", flexShrink:0 }}>{initials(item.nome)}</div>
                }
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#f1f5f9" }}>{item.nome}</div>
                  {item.cidade && <div style={{ fontSize:11, color:"#64748b" }}>{item.cidade}</div>}
                </div>
              </div>
              <div style={{ display:"flex", gap:5 }}>
                <button onClick={() => mover(item,-1)} disabled={idx===0} style={{ padding:"5px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#64748b", fontSize:12, cursor:"pointer" }}>↑</button>
                <button onClick={() => mover(item, 1)} disabled={idx===sorted.length-1} style={{ padding:"5px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#64748b", fontSize:12, cursor:"pointer" }}>↓</button>
                <button onClick={() => { setForm({ nome:item.nome, cidade:item.cidade??"", comentario:item.comentario, nota:item.nota, foto_url:item.foto_url??"" }); setModal({ mode:"edit", item }); setErro(""); }} style={{ flex:1, padding:"5px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#94a3b8", fontSize:12, cursor:"pointer" }}>Editar</button>
                <button onClick={() => excluir(item.id)} style={{ padding:"5px 8px", borderRadius:6, border:"1px solid rgba(239,68,68,0.3)", background:"transparent", color:"#f87171", fontSize:12, cursor:"pointer" }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(6px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={() => setModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#0a0d14", border:"1px solid rgba(255,255,255,0.10)", borderRadius:20, padding:"28px 24px", maxWidth:480, width:"100%", maxHeight:"90vh", overflowY:"auto" }}>
            <h3 style={{ fontSize:17, fontWeight:700, color:"#f1f5f9", margin:"0 0 20px" }}>{modal.mode==="add" ? "Adicionar Depoimento" : "Editar Depoimento"}</h3>
            {erro && <div style={{ background:"rgba(239,68,68,0.10)", border:"1px solid rgba(239,68,68,0.3)", color:"#f87171", borderRadius:8, padding:"8px 12px", marginBottom:14, fontSize:13 }}>{erro}</div>}

            {/* Nota com estrelas */}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:8 }}>Nota</label>
              <div style={{ display:"flex", gap:6 }}>
                {[1,2,3,4,5].map(s => (
                  <button key={s} type="button" onClick={() => setForm(p => ({...p, nota:s}))}
                    style={{ fontSize:26, background:"none", border:"none", cursor:"pointer", color: s <= form.nota ? "#f59e0b" : "#334155", transition:"color 0.15s", padding:"2px 4px" }}>
                    ★
                  </button>
                ))}
                <span style={{ fontSize:13, color:"#64748b", alignSelf:"center", marginLeft:4 }}>{form.nota} estrela{form.nota !== 1 ? "s" : ""}</span>
              </div>
            </div>

            {/* Foto (opcional) */}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:6 }}>Foto do cliente (opcional)</label>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div onClick={() => fileRef.current?.click()} style={{ width:56, height:56, borderRadius:"50%", border:"2px dashed rgba(255,255,255,0.12)", cursor:"pointer", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(255,255,255,0.02)", position:"relative", flexShrink:0 }}>
                  {form.foto_url ? <img src={form.foto_url} alt="avatar" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <span style={{ fontSize:20, color:"#334155" }}>👤</span>}
                  {uploading && <div style={{ position:"absolute", inset:0, background:"rgba(10,13,20,0.85)", display:"flex", alignItems:"center", justifyContent:"center", borderRadius:"50%" }}><span style={{ fontSize:10, color:"#c4b5fd" }}>...</span></div>}
                </div>
                <span style={{ fontSize:12, color:"#64748b" }}>Clique no circulo para enviar uma foto</span>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => e.target.files?.[0] && uploadFoto(e.target.files[0])} />
            </div>

            {[
              { label:"Nome do cliente *", key:"nome", placeholder:"Ana Carolina" },
              { label:"Cidade", key:"cidade", placeholder:"Sao Paulo, SP" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:12 }}>
                <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:6 }}>{f.label}</label>
                <input value={form[f.key as keyof Form] as string} onChange={e => setForm(p => ({...p, [f.key]:e.target.value}))} placeholder={f.placeholder} className="input-field" />
              </div>
            ))}

            <div style={{ marginBottom:22 }}>
              <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:6 }}>Comentario *</label>
              <textarea value={form.comentario} onChange={e => setForm(p => ({...p, comentario:e.target.value}))} placeholder="Excelente atendimento, resultado incrivel..." className="input-field" style={{ resize:"vertical", minHeight:90 }} />
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setModal(null)} className="button-secondary" style={{ flex:1, padding:12, fontSize:14 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando||uploading} className="button-primary" style={{ flex:2, padding:12, fontSize:14 }}>
                {salvando ? "Salvando..." : "Salvar Depoimento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
