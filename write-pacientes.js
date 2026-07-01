const fs = require('fs');
const code = `"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const pacientesDemo = [
  { id:1, nome:"Maria Silva", whatsapp:"(43) 99999-1111", email:"maria@email.com", nascimento:"15/03/1985", ultima:"10/05/2026", status:"ativo" },
  { id:2, nome:"João Pereira", whatsapp:"(43) 98888-2222", email:"joao@email.com", nascimento:"22/07/1990", ultima:"08/05/2026", status:"ativo" },
  { id:3, nome:"Ana Costa", whatsapp:"(43) 97777-3333", email:"ana@email.com", nascimento:"05/11/1978", ultima:"01/05/2026", status:"ativo" },
  { id:4, nome:"Carlos Mendes", whatsapp:"(43) 96666-4444", email:"carlos@email.com", nascimento:"30/01/2000", ultima:"15/04/2026", status:"inativo" },
  { id:5, nome:"Fernanda Lima", whatsapp:"(43) 95555-5555", email:"fernanda@email.com", nascimento:"18/06/1995", ultima:"12/05/2026", status:"ativo" },
];

export default function Pacientes() {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [pacientes, setPacientes] = useState(pacientesDemo);

  const filtrados = pacientes.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()));

  function adicionar() {
    if (!nome || !whatsapp) return;
    setPacientes([...pacientes, { id: Date.now(), nome, whatsapp, email, nascimento: "-", ultima: "-", status: "ativo" }]);
    setNome(""); setWhatsapp(""); setEmail(""); setModal(false);
  }

  return (
    <div style={{display:"flex",height:"100vh",background:"#f8fafc",fontFamily:"Inter,sans-serif"}}>
      <aside style={{width:230,minWidth:230,background:"#fff",borderRight:"1px solid #e2e8f0",display:"flex",flexDirection:"column",padding:"20px 0"}}>
        <div style={{padding:"0 20px 20px",borderBottom:"1px solid #e2e8f0",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18,fontWeight:700,color:"#1e293b"}}>ClínicaFlow</span>
            <span style={{fontSize:10,background:"#ede9fe",color:"#7c3aed",padding:"2px 7px",borderRadius:6,fontWeight:600}}>Beta</span>
          </div>
          <div style={{fontSize:11,color:"#94a3b8",marginTop:3}}>Odontologia</div>
        </div>
        {[{e:"🏠",l:"Dashboard",h:"/"},{e:"📅",l:"Agenda",h:"/agendamentos"},{e:"👥",l:"Pacientes",h:"/pacientes"}].map(item=>(
          <div key={item.h} onClick={()=>router.push(item.h)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 20px",fontSize:13,cursor:"pointer",color:item.h==="/pacientes"?"#7c3aed":"#475569",background:item.h==="/pacientes"?"#f5f3ff":"transparent",fontWeight:item.h==="/pacientes"?600:400,borderRight:item.h==="/pacientes"?"3px solid #7c3aed":"3px solid transparent"}}>
            <span>{item.e}</span>{item.l}
          </div>
        ))}
        <div style={{padding:"12px 20px 4px",fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Crescimento</div>
        {[{e:"💬",l:"Automações",h:"/automacao"},{e:"⭐",l:"Reputação",h:"/reputacao"},{e:"✨",l:"Conteúdo IA",h:"/conteudo"}].map(item=>(
          <div key={item.h} onClick={()=>router.push(item.h)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 20px",fontSize:13,cursor:"pointer",color:"#475569"}}>
            <span>{item.e}</span>{item.l}
          </div>
        ))}
        <div style={{marginTop:"auto",padding:"16px 20px",borderTop:"1px solid #e2e8f0"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:"#ede9fe",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#7c3aed"}}>CF</div>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>Clínica Flow</div>
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
          <span style={{fontSize:16}}>🔍</span>
          <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar paciente..." style={{border:"none",outline:"none",fontSize:13,color:"#1e293b",flex:1,background:"transparent"}} />
        </div>

        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:"#f8fafc"}}>
                {["Paciente","WhatsApp","Última consulta","Status",""].map(h=>(
                  <th key={h} style={{padding:"10px 16px",fontSize:11,fontWeight:600,color:"#64748b",textAlign:"left",borderBottom:"1px solid #e2e8f0",textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</th>
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
                  <td style={{padding:"12px 16px",fontSize:13,color:"#475569"}}>{p.ultima}</td>
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
              <button onClick={adicionar} style={{flex:1,padding:"9px",borderRadius:8,border:"none",background:"#7c3aed",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}`;
fs.writeFileSync('app/pacientes/page.tsx', code, 'utf8');
console.log('Pacientes escrito com sucesso!');
