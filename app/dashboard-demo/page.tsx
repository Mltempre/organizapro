"use client";

import AdminShell from "../components/AdminShell";

const recursos = [
  ["👥", "Clientes"], ["📅", "Agenda"], ["🌐", "Site"],
  ["✍️", "Conteúdo IA"], ["💬", "Chatbot"], ["🤖", "Automação"],
  ["⭐", "Reputação"], ["📈", "Métricas"], ["📊", "Raio-X Inteligente"],
];

const agenda = [
  { hora: "09:00", cliente: "Empresa Horizonte", servico: "Reunião", responsavel: "Comercial", status: "Confirmado", cor: "#4ade80" },
  { hora: "11:30", cliente: "João Martins", servico: "Retorno", responsavel: "Equipe", status: "Confirmado", cor: "#4ade80" },
  { hora: "14:00", cliente: "Comercial Aurora", servico: "Apresentação", responsavel: "Administrativo", status: "Aguardando", cor: "#fbbf24" },
];

export default function DashboardDemo() {
  return (
    <AdminShell title="Painel Executivo">
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .dc { animation: fadeUp .35s ease both; }
        .demo-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
        .bottom-grid { display:grid; grid-template-columns:1.15fr .85fr; gap:16px; }
        @media(max-width:860px){.demo-grid,.bottom-grid{grid-template-columns:1fr}}
      `}</style>

      <div className="dc" style={{display:"inline-flex",alignItems:"center",gap:10,padding:"10px 16px",borderRadius:12,marginBottom:20,background:"rgba(74,155,176,.08)",border:"1px solid rgba(74,155,176,.2)"}}>
        <span style={{fontSize:18}}>📅</span>
        <div><div style={{fontSize:10,fontWeight:800,color:"#4a9bb0",textTransform:"uppercase",letterSpacing:".06em"}}>Hoje</div><div style={{fontSize:14,fontWeight:700,color:"#f1f5f9"}}>Segunda-feira, 13 de julho</div></div>
      </div>

      <div className="dc" style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:20}}>
        {recursos.map(([icon,label])=><span key={label} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 13px",borderRadius:999,background:"rgba(74,155,176,.07)",border:"1px solid rgba(74,155,176,.18)",color:"#cbd5e1",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}><span style={{color:"#4ade80"}}>✔</span> {icon} {label}</span>)}
      </div>

      <section className="dc" style={{background:"linear-gradient(135deg,rgba(74,155,176,.12),rgba(31,78,95,.22))",border:"1px solid rgba(74,155,176,.3)",borderRadius:16,padding:"22px 24px",marginBottom:20,boxShadow:"0 8px 24px rgba(0,0,0,.15)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:36,height:36,borderRadius:10,background:"rgba(74,155,176,.18)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>🎯</div><strong style={{fontSize:16,color:"#f1f5f9"}}>Seu Plano para Hoje</strong></div>
          <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:10,fontWeight:800,color:"#64748b",letterSpacing:".08em",textTransform:"uppercase"}}>Status Operacional</span><span style={{padding:"5px 12px",borderRadius:999,background:"rgba(251,191,36,.12)",border:"1px solid rgba(251,191,36,.3)",color:"#fbbf24",fontSize:12,fontWeight:700}}>🟡 Atenção</span></div>
        </div>
        <div style={{fontSize:14,fontWeight:600,color:"#cbd5e1",margin:"6px 0 4px"}}>👋 Bom dia!<br/>Bem-vindo ao OrganizaPro.</div>
        <p style={{fontSize:13,color:"#94a3b8",lineHeight:1.6,margin:"0 0 20px"}}>Acompanhe suas prioridades e mantenha sua empresa organizada durante todo o dia.</p>
        <div className="demo-grid">
          {[
            ["Prioridades","2","clientes aguardando retorno.","#f87171"],
            ["Agenda","5","compromissos agendados.","#4a9bb0"],
            ["Oportunidades","3","clientes podem voltar a fazer negócio.","#4ade80"],
          ].map(([titulo,numero,texto,cor])=><div key={titulo} style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,padding:16}}><div style={{fontSize:10,fontWeight:800,color:"#94a3b8",letterSpacing:".08em",textTransform:"uppercase",marginBottom:8}}>{titulo}</div><div style={{fontSize:30,fontWeight:900,lineHeight:1,color:cor,marginBottom:6}}>{numero}</div><p style={{fontSize:12,color:"#94a3b8",margin:0}}>{texto}</p></div>)}
        </div>
        <div style={{marginTop:20,paddingTop:20,borderTop:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"flex-start",gap:12}}>
          <div style={{width:40,height:40,borderRadius:"50%",flexShrink:0,background:"linear-gradient(135deg,#1F4E5F,#0d3547)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>👔</div>
          <div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}><strong style={{fontSize:14,color:"#f1f5f9"}}>Diretor Digital</strong><span style={{fontSize:9.5,fontWeight:700,textTransform:"uppercase",color:"#4a9bb0",background:"rgba(74,155,176,.12)",border:"1px solid rgba(74,155,176,.25)",borderRadius:999,padding:"2px 8px"}}>OrganizaPro Intelligence</span></div><p style={{fontSize:13,color:"#cbd5e1",lineHeight:1.55,margin:"0 0 12px"}}>Bom dia. Analisei a rotina da Empresa Demonstração e identifiquei a ação mais importante para hoje.</p><div style={{background:"rgba(251,191,36,.1)",border:"1px solid rgba(251,191,36,.3)",borderRadius:12,padding:"14px 16px"}}><div style={{fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:".08em",color:"#fbbf24",marginBottom:6}}>🎯 Prioridade do Diretor</div><strong style={{fontSize:14,color:"#f1f5f9"}}>Confirmar a apresentação da tarde</strong><p style={{fontSize:12,color:"#94a3b8",lineHeight:1.45,margin:"5px 0 0"}}>O compromisso com a Comercial Aurora ainda aguarda confirmação. Antecipar esse contato reduz imprevistos para a equipe.</p></div></div>
        </div>
      </section>

      <div className="bottom-grid dc">
        <section style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,padding:"18px 20px"}}><div style={{fontSize:11,fontWeight:800,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".08em",marginBottom:14}}>Agenda de hoje</div>{agenda.map((item,i)=><div key={item.hora} style={{display:"grid",gridTemplateColumns:"52px 1.4fr .8fr .8fr",gap:12,alignItems:"center",padding:"10px 0",borderBottom:i<agenda.length-1?"1px solid rgba(255,255,255,.05)":"none"}}><span style={{fontSize:12,color:"#64748b"}}>{item.hora}</span><div><div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{item.cliente}</div><div style={{fontSize:11,color:"#64748b"}}>{item.servico}</div></div><span style={{fontSize:11,color:"#94a3b8"}}>{item.responsavel}</span><span style={{fontSize:11,fontWeight:700,color:item.cor,textAlign:"right"}}>{item.status}</span></div>)}</section>
        <section style={{background:"linear-gradient(135deg,rgba(31,78,95,.18),rgba(13,53,71,.25))",border:"1px solid rgba(31,78,95,.35)",borderRadius:14,padding:"20px 22px"}}><div style={{fontSize:11,fontWeight:800,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".08em",marginBottom:16}}>Panorama do dia</div>{[["🟢","5","compromissos hoje","#4ade80"],["🟡","2","aguardando confirmação","#fbbf24"],["🔴","0","em atraso","#64748b"]].map(([icon,n,label,cor])=><div key={label} style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}><span>{icon}</span><strong style={{fontSize:25,color:cor,minWidth:30}}>{n}</strong><span style={{fontSize:13,color:"#94a3b8"}}>{label}</span></div>)}</section>
      </div>
    </AdminShell>
  );
}
