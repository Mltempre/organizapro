const fs = require('fs');
const code = `"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function entrar() {
    if (!email || !senha) { setErro("Preencha email e senha"); return; }
    setLoading(true);
    setErro("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) { setErro("Erro: " + error.message); setLoading(false); return; }
      if (data.session) { router.push("/"); }
      else { setErro("Sessao nao criada - tente novamente"); setLoading(false); }
    } catch(e: any) {
      setErro("Excecao: " + e.message);
      setLoading(false);
    }
  }

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#667eea 0%,#764ba2 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif"}}>
      <div style={{background:"#fff",borderRadius:20,padding:"40px 36px",width:400,boxShadow:"0 25px 50px rgba(0,0,0,0.15)"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:32,marginBottom:8}}>🦷</div>
          <h1 style={{fontSize:24,fontWeight:700,color:"#1e293b",margin:0}}>BOLÃO SHORTS AI</h1>
          <p style={{fontSize:14,color:"#64748b",margin:"8px 0 0"}}>Acesse sua plataforma</p>
        </div>
        <div style={{marginBottom:16}}>
          <label style={{fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:6}}>EMAIL</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" onKeyDown={e=>e.key==="Enter"&&entrar()} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:14,outline:"none",boxSizing:"border-box"}} />
        </div>
        <div style={{marginBottom:8}}>
          <label style={{fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:6}}>SENHA</label>
          <input type="password" value={senha} onChange={e=>setSenha(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&entrar()} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:14,outline:"none",boxSizing:"border-box"}} />
        </div>
        {erro && <div style={{background:"#fee2e2",color:"#991b1b",fontSize:12,padding:"10px 14px",borderRadius:8,marginBottom:16}}>{erro}</div>}
        <button onClick={entrar} disabled={loading} style={{width:"100%",padding:"13px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#667eea,#764ba2)",color:"#fff",fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer",marginTop:8,opacity:loading?0.8:1}}>{loading?"Entrando...":"Entrar"}</button>
        <div style={{textAlign:"center",marginTop:20,fontSize:12,color:"#94a3b8"}}>ClínicaFlow © 2026 · Plataforma para clínicas</div>
      </div>
    </div>
  );
}`;
fs.writeFileSync('app/login/page.tsx', code, 'utf8');
console.log('Login atualizado!');
