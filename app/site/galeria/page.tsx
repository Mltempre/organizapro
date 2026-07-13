"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminShell from "../../components/AdminShell";

type Item = { id: string; url: string; categoria: string; titulo: string | null; ordem: number; };

const CATS = ["Fachada","Recepcao","Sala de Espera","Espaco de Atendimento","Equipamentos","Equipe","Outros"];
const NAV  = [
  { l:"Configuracoes", h:"/site",              i:"⚙️"  },
  { l:"Galeria",       h:"/site/galeria",      i:"📸", a:true },
  { l:"Equipe",        h:"/site/equipe",       i:"👥"  },
  { l:"Antes/Depois",  h:"/site/antes-depois", i:"✨"  },
  { l:"Depoimentos",   h:"/site/depoimentos",  i:"💬"  },
  { l:"Servicos",      h:"/site/servicos",     i:"🛠️"  },
  { l:"Estrutura",     h:"/site/estrutura",    i:"🏢"  },
  { l:"FAQ",           h:"/site/faq",        i:"❓"  },
];

export default function GaleriaAdmin() {
  const router = useRouter();
  const [clinicaId, setClinicaId] = useState("");
  const [itens, setItens]         = useState<Item[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState<{ mode:"add"|"edit"; item?: Item }|null>(null);
  const [form, setForm]           = useState({ url:"", categoria:"Espaco de Atendimento", titulo:"" });
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
      const { data } = await supabase.from("clinica_galeria").select("*").eq("clinica_id", cu.clinica_id).order("ordem");
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
    fd.append("file", file); fd.append("tipo", "galeria"); fd.append("clinica_id", clinicaId);
    const res  = await fetch("/api/upload", { method:"POST", headers:{ Authorization:`Bearer ${session.access_token}` }, body:fd });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) { setErro(data.error || "Erro no upload."); return; }
    setForm(p => ({ ...p, url: data.url }));
  }

  async function salvar() {
    if (!form.url) { setErro("Envie uma foto."); return; }
    setSalvando(true); setErro("");
    if (modal?.mode === "add") {
      const maxOrdem = itens.length ? Math.max(...itens.map(i => i.ordem)) + 1 : 0;
      const { error } = await supabase.from("clinica_galeria").insert({ clinica_id:clinicaId, url:form.url, categoria:form.categoria, titulo:form.titulo||null, ordem:maxOrdem });
      if (error) { setErro("Erro ao salvar."); setSalvando(false); return; }
    } else if (modal?.item) {
      const { error } = await supabase.from("clinica_galeria").update({ url:form.url, categoria:form.categoria, titulo:form.titulo||null }).eq("id", modal.item.id);
      if (error) { setErro("Erro ao salvar."); setSalvando(false); return; }
    }
    setSalvando(false); setModal(null); carregar();
  }

  async function excluir(id: string) {
    if (!window.confirm("Excluir esta foto?")) return;
    await supabase.from("clinica_galeria").delete().eq("id", id);
    carregar();
  }

  async function mover(item: Item, dir: -1|1) {
    const sorted = [...itens].sort((a,b) => a.ordem - b.ordem);
    const idx  = sorted.findIndex(i => i.id === item.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("clinica_galeria").update({ ordem: swap.ordem }).eq("id", item.id),
      supabase.from("clinica_galeria").update({ ordem: item.ordem }).eq("id", swap.id),
    ]);
    carregar();
  }

  const sorted = [...itens].sort((a,b) => a.ordem - b.ordem);

  return (
    <AdminShell title="Galeria de Fotos" subtitle="Fotos do negocio exibidas no site publico" actionLabel="+ Adicionar Foto" actionOnClick={() => { setForm({ url:"", categoria:"Espaco de Atendimento", titulo:"" }); setModal({ mode:"add" }); setErro(""); }}>

      {/* MODULE NAV */}
      <nav style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:24 }}>
        {NAV.map(m => (
          <button key={m.h} onClick={() => router.push(m.h)} style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${m.a ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.08)"}`, background:m.a ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.02)", color:m.a ? "#c4b5fd" : "#64748b", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:6, fontWeight:m.a ? 600 : 400, whiteSpace:"nowrap" }}>
            {m.i} {m.l}
          </button>
        ))}
      </nav>

      {loading && <p style={{ color:"var(--muted)" }}>Carregando...</p>}

      {!loading && itens.length === 0 && (
        <div className="panel" style={{ textAlign:"center", padding:"52px 20px" }}>
          <div style={{ fontSize:44, marginBottom:14 }}>📸</div>
          <p style={{ color:"var(--muted)", margin:0, fontSize:15 }}>Nenhuma foto cadastrada ainda. Clique em &ldquo;+ Adicionar Foto&rdquo; para comecar.</p>
        </div>
      )}

      {sorted.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:16 }}>
          {sorted.map((item, idx) => (
            <div key={item.id} style={{ background:"var(--surface)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, overflow:"hidden" }}>
              <div style={{ position:"relative", height:144 }}>
                <img src={item.url} alt={item.titulo ?? item.categoria} style={{ width:"100%", height:"100%", objectFit:"cover" }} loading="lazy" />
                <div style={{ position:"absolute", top:8, left:8, background:"rgba(0,0,0,0.72)", borderRadius:6, padding:"2px 10px", fontSize:10, color:"#fff", fontWeight:700, letterSpacing:"0.05em" }}>
                  {item.categoria}
                </div>
              </div>
              <div style={{ padding:"10px 12px" }}>
                {item.titulo && <div style={{ fontSize:12, color:"rgba(255,255,255,0.8)", marginBottom:8, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.titulo}</div>}
                <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                  <button onClick={() => mover(item,-1)} disabled={idx===0} style={{ padding:"5px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#64748b", fontSize:12, cursor:"pointer" }}>↑</button>
                  <button onClick={() => mover(item, 1)} disabled={idx===sorted.length-1} style={{ padding:"5px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#64748b", fontSize:12, cursor:"pointer" }}>↓</button>
                  <button onClick={() => { setForm({ url:item.url, categoria:item.categoria, titulo:item.titulo??""  }); setModal({ mode:"edit", item }); setErro(""); }} style={{ flex:1, padding:"5px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#94a3b8", fontSize:12, cursor:"pointer" }}>Editar</button>
                  <button onClick={() => excluir(item.id)} style={{ padding:"5px 8px", borderRadius:6, border:"1px solid rgba(239,68,68,0.3)", background:"transparent", color:"#f87171", fontSize:12, cursor:"pointer" }}>✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(6px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={() => setModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#0a0d14", border:"1px solid rgba(255,255,255,0.10)", borderRadius:20, padding:"28px 24px", maxWidth:440, width:"100%" }}>
            <h3 style={{ fontSize:17, fontWeight:700, color:"#f1f5f9", margin:"0 0 20px" }}>{modal.mode==="add" ? "Adicionar Foto" : "Editar Foto"}</h3>
            {erro && <div style={{ background:"rgba(239,68,68,0.10)", border:"1px solid rgba(239,68,68,0.3)", color:"#f87171", borderRadius:8, padding:"8px 12px", marginBottom:14, fontSize:13 }}>{erro}</div>}

            <div style={{ marginBottom:16, cursor:"pointer", border:"2px dashed rgba(255,255,255,0.12)", borderRadius:12, overflow:"hidden", position:"relative", height:170 }} onClick={() => fileRef.current?.click()}>
              {form.url ? <img src={form.url} alt="preview" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : (
                <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, color:"#475569" }}>
                  <span style={{ fontSize:32 }}>📷</span>
                  <span style={{ fontSize:13 }}>Clique para enviar foto</span>
                  <span style={{ fontSize:11, color:"#334155" }}>PNG, JPG, até 5 MB</span>
                </div>
              )}
              {uploading && <div style={{ position:"absolute", inset:0, background:"rgba(10,13,20,0.82)", display:"flex", alignItems:"center", justifyContent:"center", color:"#c4b5fd", fontSize:14, fontWeight:600 }}>Enviando...</div>}
              {form.url && !uploading && <div style={{ position:"absolute", bottom:8, right:8, background:"rgba(0,0,0,0.7)", color:"#fff", fontSize:11, padding:"3px 10px", borderRadius:6 }}>Clique para trocar</div>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => e.target.files?.[0] && uploadFoto(e.target.files[0])} />

            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:6 }}>Categoria</label>
              <select value={form.categoria} onChange={e => setForm(p => ({...p, categoria:e.target.value}))} className="input-field">
                {CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ marginBottom:22 }}>
              <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:6 }}>Titulo (opcional)</label>
              <input value={form.titulo} onChange={e => setForm(p => ({...p, titulo:e.target.value}))} placeholder="Ex: Recepcao principal" className="input-field" />
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setModal(null)} className="button-secondary" style={{ flex:1, padding:12, fontSize:14 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando||uploading} className="button-primary" style={{ flex:2, padding:12, fontSize:14 }}>
                {salvando ? "Salvando..." : "Salvar Foto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
