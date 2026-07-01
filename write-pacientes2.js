const fs = require('fs');
const code = `"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Paciente = {
  id: string;
  nome: string;
  whatsapp: string;
  email: string;
  nascimento: string;
  status: string;
  ultima_consulta: string;
};

export default function Pacientes() {
  const router = useRouter();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from("pacientes").select("*").order("created_at", { ascending: false });
    if (data) setPacientes(data);
    setLoading(false);
  }

  async function adicionar() {
    if (!nome || !whatsapp) return;
    setSalvando(true);
    const { error } = await supabase.from("pacientes").insert([{ nome, whatsapp, email, status: "ativo" }]);
    if (!error) { setNome(""); setWhatsapp(""); setEmail(""); setModal(false); carregar(); }
    setSalvando(false);
  }

  const filtrados = pacientes.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div style={{display:"flex",height:"100vh",background:"#f8fafc",fontFamily:"Inter,sans-serif"}}>
      <aside style={{width:230,minWidth:230,background:"#fff",borderRight:"1px solid #e2e8f0",display:"flex",flexDirection:"column",padding:"20px 0"}}>
        <div style={{padding:"0 20px 20px",borderBottom:"1px solid #e2e8f0",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18,fontWeight:700,color:"#1e293b"}}>BOLÃO SHORTS AI</span>
            <span style={{fontSize:10,background:"#ede9fe",color:"#7c3aed",padding:"2px 7px",borderRadius:6,fontWeight:600}}>Beta</span>
          </div>
          <div style={{fontSize:11,color:"#94a3b8",marginTop:3}}>Odontologia</div>
        </div>
        {[{l:"Dashboard",h:"/"},{l:"Agenda",h:"/agendamentos"},{l:"Pacientes",h:"/pacientes"},{l:"Automacoes",h:"/automacao"},{l:"Reputacao",h:"/reputacao"},{l:"Conteudo IA",h:"/conteudo"},{l:"Site",h:"/site"},{l:"Config",h:"/configuracoes"}].map(item=>(
          <div key={item.h} onClick={()=>router.push(item.h)} style={{padding:"8px 20px",fontSize:13,cursor:"pointer",color:item.h==="/pacientes"?"#7c3aed":"#475569",background:item.h==="/pacientes"?"#f5f3ff":"transparent",fontWeight:item.h==="/pacientes"?600:400,borderRight:item.h==="/pacientes"?"3px solid #7c3aed":"3px solid transparent"}}>
            {item.l}
          </div>
        ))}
        <div style={{marginTop:"auto",padding:"16px 20px",borderTop:"1px solid #e2e8f0"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:"#ede9fe",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#7c3aed"}}>CF</div>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>Clinica Flow</div>
              <div style={{fontSize:11,color:"#94a3b8"}}>Administrador</div>
            </div>
          </div>
        </div>
      </aside>

      <main style={{flex:1,overflowY:"auto",padding:"24px 28px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:700,color:"#1e293b",margin:0}}>Pacientes</h1>
            <p style={{fontSize:13,color:"#64748b",margin:"4px 0 0"}}>{filtrados.length} pacientes cadastrados</p>
          </div>
          <button onClick={()=>setModal(true)} style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#7c3aed",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Novo paciente</button>
        </div>

        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
          <span>🔍</span>
          <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar paciente..." style={{border:"none",outline:"none",fontSize:13,color:"#1e293b",flex:1,background:"transparent"}} />
        </div>

        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,overflow:"hidden"}}>
          {loading ? (
            <div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>Carregando pacientes...</div>
          ) : filtrados.length === 0 ? (
            <div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>Nenhum paciente encontrado. Adicione o primeiro!</div>
          ) : (
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#f8fafc"}}>
                  {["Paciente","WhatsApp","Status",""].map(h=>(
                    <th key={h} style={{padding:"10px 16px",fontSize:11,fontWeight:600,color:"#64748b",textAlign:"left",borderBottom:"1px solid #e2e8f0",textTransform:"uppercase"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p,i)=>(
                  <tr key={p.id} style={{borderBottom:i<filtrados.length-1?"1px solid #f1f5f9":"none"}}>
                    <td style={{padding:"12px 16px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:32,height:32,borderRadius:"50%",background:"#ede9fe",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#7c3aed"}}>{p.nome.split(" ").map((n:string)=>n[0]).slice(0,2).join("")}</div>
                        <div>
                          <div style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{p.nome}</div>
                          <div style={{fontSize:11,color:"#64748b"}}>{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{padding:"12px 16px",fontSize:13,color:"#475569"}}>{p.whatsapp}</td>
                    <td style={{padding:"12px 16px"}}>
                      <span style={{fontSize:11,padding:"3px 10px",borderRadius:10,background:p.status==="ativo"?"#dcfce7":"#f1f5f9",color:p.status==="ativo"?"#166534":"#64748b",fontWeight:600}}>{p.status==="ativo"?"Ativo":"Inativo"}</span>
                    </td>
                    <td style={{padding:"12px 16px"}}>
                      <button style={{fontSize:12,padding:"4px 12px",borderRadius:6,border:"1px solid #e2e8f0",background:"#fff",color:"#475569",cursor:"pointer"}}>Ver</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {modal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50}}>
          <div style={{background:"#fff",borderRadius:16,padding:28,width:420,boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
            <h2 style={{fontSize:16,fontWeight:700,color:"#1e293b",marginBottom:20}}>Novo Paciente</h2>
            {[{l:"Nome completo",v:nome,s:setNome,p:"Ex: Maria Silva"},{l:"WhatsApp",v:whatsapp,s:setWhatsapp,p:"(43) 99999-9999"},{l:"Email",v:email,s:setEmail,p:"email@exemplo.com"}].map(f=>(
              <div key={f.l} style={{marginBottom:14}}>
                <label style={{fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:4}}>{f.l}</label>
                <input value={f.v} onChange={e=>f.s(e.target.value)} placeholder={f.p} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,outline:"none",boxSizing:"border-box"}} />
              </div>
            ))}
            <div style={{display:"flex",gap:10,marginTop:20}}>
              <button onClick={()=>setModal(false)} style={{flex:1,padding:"9px",borderRadius:8,border:"1px solid #e2e8f0",background:"#fff",fontSize:13,cursor:"pointer",color:"#475569"}}>Cancelar</button>
              <button onClick={adicionar} disabled={salvando} style={{flex:1,padding:"9px",borderRadius:8,border:"none",background:"#7c3aed",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",opacity:salvando?0.7:1}}>{salvando?"Salvando...":"Adicionar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}`;
fs.writeFileSync('app/pacientes/page.tsx', code, 'utf8');
console.log('Pacientes com Supabase escrito!');
