const fs = require('fs');
const code = `"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const menu = [
  { s: "Principal", items: [{ e: "🏠", l: "Dashboard", h: "/" },{ e: "📅", l: "Agenda", h: "/agendamentos" },{ e: "👥", l: "Pacientes", h: "/pacientes" }]},
  { s: "Crescimento", items: [{ e: "💬", l: "Automações", h: "/automacao" },{ e: "⭐", l: "Reputação", h: "/reputacao" },{ e: "✨", l: "Conteúdo IA", h: "/conteudo" },{ e: "📆", l: "Cal. Posts", h: "/calendario" }]},
  { s: "Clínica", items: [{ e: "🌐", l: "Site", h: "/site" },{ e: "📊", l: "Relatórios", h: "/relatorios" },{ e: "⚙️", l: "Config", h: "/configuracoes" }]},
];

const agenda = [
  { h: "08:00", n: "Maria Silva", p: "Limpeza + Clareamento", s: "confirmado" },
  { h: "09:30", n: "João Pereira", p: "Extração — dente 36", s: "aguardando" },
  { h: "11:00", n: "Ana Costa", p: "Canal — retorno", s: "confirmado" },
  { h: "14:00", n: "Carlos Mendes", p: "Consulta inicial", s: "novo" },
];

const autos = [
  { e: "💬", l: "Confirmação de consulta", s: "24h antes via WhatsApp", a: true, c: "#dcfce7" },
  { e: "⏰", l: "Lembrete de retorno", s: "Follow-up 30 dias após consulta", a: true, c: "#fef9c3" },
  { e: "⭐", l: "Pedido de avaliação", s: "Google após atendimento", a: true, c: "#ede9fe" },
  { e: "✨", l: "Post IA semanal", s: "Gera legenda para Instagram", a: false, c: "#fee2e2" },
];

const st: Record<string,{bg:string;color:string;label:string}> = {
  confirmado:{bg:"#dcfce7",color:"#166534",label:"Confirmado"},
  aguardando:{bg:"#fef9c3",color:"#854d0e",label:"Aguardando"},
  novo:{bg:"#dbeafe",color:"#1e40af",label:"Novo"},
};

export default function Dashboard() {
  const router = useRouter();
  const [active, setActive] = useState("/");
  const [ats, setAts] = useState(autos.map(a=>a.a));
  const hoje = new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

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
        {menu.map(g=>(
          <div key={g.s}>
            <div style={{padding:"12px 20px 4px",fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>{g.s}</div>
            {g.items.map(item=>(
              <div key={item.h} onClick={()=>{setActive(item.h);router.push(item.h);}} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 20px",fontSize:13,cursor:"pointer",color:active===item.h?"#7c3aed":"#475569",background:active===item.h?"#f5f3ff":"transparent",fontWeight:active===item.h?600:400,borderRight:active===item.h?"3px solid #7c3aed":"3px solid transparent"}}>
                <span>{item.e}</span>{item.l}
              </div>
            ))}
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
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:700,color:"#1e293b",margin:0}}>Bom dia, Clínica Flow 👋</h1>
            <p style={{fontSize:13,color:"#64748b",margin:"4px 0 0"}}>{hoje.charAt(0).toUpperCase()+hoje.slice(1)}</p>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:8,border:"1px solid #e2e8f0",background:"#fff",fontSize:13,color:"#475569",cursor:"pointer"}}>🔔 <span style={{background:"#ef4444",color:"#fff",fontSize:10,padding:"1px 6px",borderRadius:10}}>3</span></button>
            <button style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",borderRadius:8,border:"none",background:"#7c3aed",fontSize:13,color:"#fff",cursor:"pointer",fontWeight:600}}>+ Novo agendamento</button>
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:24}}>
          <span style={{fontSize:12,padding:"5px 14px",borderRadius:20,background:"#7c3aed",color:"#fff",fontWeight:600}}>🦷 Odontologia</span>
          <span style={{fontSize:12,padding:"5px 14px",borderRadius:20,border:"1px solid #e2e8f0",color:"#64748b",cursor:"pointer"}}>+ Adicionar nicho</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24}}>
          {[{e:"📅",l:"Consultas hoje",v:"12",d:"+3 vs ontem",u:true},{e:"👥",l:"Novos pacientes",v:"4",d:"38 este mês",u:true},{e:"⭐",l:"Avaliação Google",v:"4.8",d:"127 avaliações",u:true},{e:"💬",l:"Confirmações",v:"89%",d:"2 sem resposta",u:false}].map(m=>(
            <div key={m.l} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:"16px 18px"}}>
              <div style={{fontSize:12,color:"#64748b",marginBottom:6}}>{m.e} {m.l}</div>
              <div style={{fontSize:26,fontWeight:700,color:"#1e293b"}}>{m.v}</div>
              <div style={{fontSize:11,marginTop:4,color:m.u?"#166534":"#9a3412"}}>{m.u?"↑":"↓"} {m.d}</div>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <span style={{fontSize:14,fontWeight:600,color:"#1e293b"}}>Agenda de hoje</span>
              <span onClick={()=>router.push("/agendamentos")} style={{fontSize:12,color:"#7c3aed",cursor:"pointer"}}>Ver tudo →</span>
            </div>
            {agenda.map((a,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<agenda.length-1?"1px solid #f1f5f9":"none"}}>
                <span style={{fontSize:12,color:"#94a3b8",minWidth:42}}>{a.h}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{a.n}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{a.p}</div>
                </div>
                <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:st[a.s].bg,color:st[a.s].color,fontWeight:600}}>{st[a.s].label}</span>
              </div>
            ))}
          </div>
          <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <span style={{fontSize:14,fontWeight:600,color:"#1e293b"}}>Automações ativas</span>
              <span onClick={()=>router.push("/automacao")} style={{fontSize:12,color:"#7c3aed",cursor:"pointer"}}>Gerenciar →</span>
            </div>
            {autos.map((a,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<autos.length-1?"1px solid #f1f5f9":"none"}}>
                <div style={{width:34,height:34,borderRadius:8,background:a.c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{a.e}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{a.l}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{a.s}</div>
                </div>
                <div onClick={()=>{const ns=[...ats];ns[i]=!ns[i];setAts(ns);}} style={{width:36,height:20,borderRadius:10,background:ats[i]?"#7c3aed":"#cbd5e1",position:"relative",cursor:"pointer"}}>
                  <div style={{position:"absolute",top:3,left:ats[i]?18:3,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}`;
fs.writeFileSync('app/page.tsx', code, 'utf8');
console.log('Dashboard escrito com sucesso!');
