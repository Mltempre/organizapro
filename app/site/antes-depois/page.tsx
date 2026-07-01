"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminShell from "../../components/AdminShell";

type Item = { id: string; antes_url: string|null; depois_url: string|null; titulo: string; descricao: string|null; ordem: number; };
type Form = { antes_url: string; depois_url: string; titulo: string; descricao: string; };

const NAV = [
  { l:"Configuracoes", h:"/site",              i:"⚙️"  },
  { l:"Galeria",       h:"/site/galeria",      i:"📸"  },
  { l:"Equipe",        h:"/site/equipe",       i:"👥"  },
  { l:"Antes/Depois",  h:"/site/antes-depois", i:"✨", a:true },
  { l:"Depoimentos",   h:"/site/depoimentos",  i:"💬"  },
  { l:"Servicos",      h:"/site/servicos",     i:"🦷"  },
  { l:"Estrutura",     h:"/site/estrutura",    i:"🏥"  },
];

export default function AntesDepoisAdmin() {
  const router = useRouter();
  const [clinicaId, setClinicaId]       = useState("");
  const [itens, setItens]               = useState<Item[]>([]);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState<{ mode:"add"|"edit"; item?: Item }|null>(null);
  const [form, setForm]                 = useState<Form>({ antes_url:"", depois_url:"", titulo:"", descricao:"" });
  const [uploadingAntes, setUploadingA] = useState(false);
  const [uploadingDepois, setUploadingD]= useState(false);
  const [salvando, setSalvando]         = useState(false);
  const [erro, setErro]                 = useState("");
  const antesRef  = useRef<HTMLInputElement>(null);
  const depoisRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: cu } = await supabase.from("clinica_usuarios").select("clinica_id").eq("usuario_id", user.id).maybeSingle();
    if (!cu?.clinica_id) { setLoading(false); return; }
    setClinicaId(cu.clinica_id);
    const { data } = await supabase.from("clinica_antes_depois").select("*").eq("clinica_id", cu.clinica_id).order("ordem");
    setItens(data ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  async function uploadImg(file: File, slot: "antes"|"depois") {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !clinicaId) return;
    const set = slot === "antes" ? setUploadingA : setUploadingD;
    set(true); setErro("");
    const fd = new FormData();
    fd.append("file", file); fd.append("tipo", "antesdepois"); fd.append("clinica_id", clinicaId);
    const res  = await fetch("/api/upload", { method:"POST", headers:{ Authorization:`Bearer ${session.access_token}` }, body:fd });
    const data = await res.json();
    set(false);
    if (!res.ok) { setErro(data.error || "Erro no upload."); return; }
    setForm(p => ({ ...p, [`${slot}_url`]: data.url }));
  }

  async function salvar() {
    if (!form.titulo.trim()) { setErro("Informe o titulo do caso."); return; }
    setSalvando(true); setErro("");
    const payload = { clinica_id:clinicaId, antes_url:form.antes_url||null, depois_url:form.depois_url||null, titulo:form.titulo.trim(), descricao:form.descricao.trim()||null };
    if (modal?.mode === "add") {
      const maxOrdem = itens.length ? Math.max(...itens.map(i => i.ordem)) + 1 : 0;
      const { error } = await supabase.from("clinica_antes_depois").insert({ ...payload, ordem:maxOrdem });
      if (error) { setErro("Erro ao salvar."); setSalvando(false); return; }
    } else if (modal?.item) {
      const { error } = await supabase.from("clinica_antes_depois").update(payload).eq("id", modal.item.id);
      if (error) { setErro("Erro ao salvar."); setSalvando(false); return; }
    }
    setSalvando(false); setModal(null); carregar();
  }

  async function excluir(id: string) {
    if (!window.confirm("Excluir este caso?")) return;
    await supabase.from("clinica_antes_depois").delete().eq("id", id);
    carregar();
  }

  async function mover(item: Item, dir: -1|1) {
    const sorted = [...itens].sort((a,b) => a.ordem - b.ordem);
    const idx  = sorted.findIndex(i => i.id === item.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("clinica_antes_depois").update({ ordem: swap.ordem }).eq("id", item.id),
      supabase.from("clinica_antes_depois").update({ ordem: item.ordem }).eq("id", swap.id),
    ]);
    carregar();
  }

  const sorted = [...itens].sort((a,b) => a.ordem - b.ordem);

  const ImgSlot = ({ url, loading: isLoading, label, onClick, color }: { url:string; loading:boolean; label:string; onClick:()=>void; color:string }) => (
    <div onClick={onClick} style={{ flex:1, border:"2px dashed rgba(255,255,255,0.10)", borderRadius:10, overflow:"hidden", cursor:"pointer", position:"relative", height:140, display:"flex", alignItems:"center", justifyContent:"center", background: url ? "transparent" : "rgba(255,255,255,0.02)" }}>
      {url ? <img src={url} alt={label} style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, color:"#475569", padding:8, textAlign:"center" }}>
          <span style={{ fontSize:24, filter:`hue-rotate(${color === "green" ? "0" : "180"}deg)` }}>{label === "Antes" ? "🙁" : "😊"}</span>
          <span style={{ fontSize:11, fontWeight:700, color: color === "green" ? "#00c896" : "#94a3b8", textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</span>
          <span style={{ fontSize:10, color:"#334155" }}>Clique para enviar</span>
        </div>
      )}
      {isLoading && <div style={{ position:"absolute", inset:0, background:"rgba(10,13,20,0.82)", display:"flex", alignItems:"center", justifyContent:"center", color:"#c4b5fd", fontSize:13 }}>Enviando...</div>}
      <div style={{ position:"absolute", top:6, left:6, background:color === "green" ? "rgba(0,200,150,0.15)" : "rgba(255,255,255,0.10)", borderRadius:6, padding:"2px 8px", fontSize:10, fontWeight:700, color: color === "green" ? "#00c896" : "rgba(255,255,255,0.5)", textTransform:"uppercase" }}>{label}</div>
    </div>
  );

  return (
    <AdminShell title="Antes e Depois" subtitle="Casos de transformacao exibidos no site" actionLabel="+ Adicionar Caso" actionOnClick={() => { setForm({ antes_url:"", depois_url:"", titulo:"", descricao:"" }); setModal({ mode:"add" }); setErro(""); }}>

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
          <div style={{ fontSize:44, marginBottom:14 }}>✨</div>
          <p style={{ color:"var(--muted)", margin:0, fontSize:15 }}>Nenhum caso cadastrado. Adicione transformacoes para exibir no site.</p>
        </div>
      )}

      {sorted.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
          {sorted.map((item, idx) => (
            <div key={item.id} style={{ background:"var(--surface)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", height:120 }}>
                <div style={{ background:"#e2e8f0", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:4, borderRight:"2px solid rgba(255,255,255,0.1)" }}>
                  {item.antes_url ? <img src={item.antes_url} alt="antes" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <span style={{ fontSize:10, color:"#94a3b8", fontWeight:700, textTransform:"uppercase" }}>Antes</span>}
                </div>
                <div style={{ background:"rgba(0,200,150,0.08)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {item.depois_url ? <img src={item.depois_url} alt="depois" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <span style={{ fontSize:10, color:"#00c896", fontWeight:700, textTransform:"uppercase" }}>Depois</span>}
                </div>
              </div>
              <div style={{ padding:"12px 14px" }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#f1f5f9", marginBottom:2 }}>{item.titulo}</div>
                {item.descricao && <div style={{ fontSize:12, color:"#64748b", marginBottom:8 }}>{item.descricao}</div>}
                <div style={{ display:"flex", gap:5 }}>
                  <button onClick={() => mover(item,-1)} disabled={idx===0} style={{ padding:"5px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#64748b", fontSize:12, cursor:"pointer" }}>↑</button>
                  <button onClick={() => mover(item, 1)} disabled={idx===sorted.length-1} style={{ padding:"5px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#64748b", fontSize:12, cursor:"pointer" }}>↓</button>
                  <button onClick={() => { setForm({ antes_url:item.antes_url??"", depois_url:item.depois_url??"", titulo:item.titulo, descricao:item.descricao??"" }); setModal({ mode:"edit", item }); setErro(""); }} style={{ flex:1, padding:"5px 8px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#94a3b8", fontSize:12, cursor:"pointer" }}>Editar</button>
                  <button onClick={() => excluir(item.id)} style={{ padding:"5px 8px", borderRadius:6, border:"1px solid rgba(239,68,68,0.3)", background:"transparent", color:"#f87171", fontSize:12, cursor:"pointer" }}>✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(6px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={() => setModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#0a0d14", border:"1px solid rgba(255,255,255,0.10)", borderRadius:20, padding:"28px 24px", maxWidth:520, width:"100%", maxHeight:"90vh", overflowY:"auto" }}>
            <h3 style={{ fontSize:17, fontWeight:700, color:"#f1f5f9", margin:"0 0 20px" }}>{modal.mode==="add" ? "Adicionar Caso" : "Editar Caso"}</h3>
            {erro && <div style={{ background:"rgba(239,68,68,0.10)", border:"1px solid rgba(239,68,68,0.3)", color:"#f87171", borderRadius:8, padding:"8px 12px", marginBottom:14, fontSize:13 }}>{erro}</div>}

            <div style={{ display:"flex", gap:12, marginBottom:16 }}>
              <ImgSlot url={form.antes_url} loading={uploadingAntes} label="Antes" color="gray" onClick={() => antesRef.current?.click()} />
              <ImgSlot url={form.depois_url} loading={uploadingDepois} label="Depois" color="green" onClick={() => depoisRef.current?.click()} />
            </div>
            <input ref={antesRef}  type="file" accept="image/*" style={{ display:"none" }} onChange={e => e.target.files?.[0] && uploadImg(e.target.files[0], "antes")} />
            <input ref={depoisRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => e.target.files?.[0] && uploadImg(e.target.files[0], "depois")} />

            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:6 }}>Titulo do caso *</label>
              <input value={form.titulo} onChange={e => setForm(p => ({...p, titulo:e.target.value}))} placeholder="Ex: Clareamento Dental" className="input-field" />
            </div>
            <div style={{ marginBottom:22 }}>
              <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:6 }}>Descricao (opcional)</label>
              <textarea value={form.descricao} onChange={e => setForm(p => ({...p, descricao:e.target.value}))} placeholder="Resultado em 2 sessoes..." className="input-field" style={{ resize:"vertical", minHeight:60 }} />
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setModal(null)} className="button-secondary" style={{ flex:1, padding:12, fontSize:14 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando||uploadingAntes||uploadingDepois} className="button-primary" style={{ flex:2, padding:12, fontSize:14 }}>
                {salvando ? "Salvando..." : "Salvar Caso"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
