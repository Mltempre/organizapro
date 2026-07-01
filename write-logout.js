const fs = require('fs');
let code = fs.readFileSync('app/dashboard/page.tsx', 'utf8');

// Adiciona import do supabase
code = code.replace(
  '"use client";',
  '"use client";\nimport { supabase } from "../../lib/supabase";'
);

// Adiciona função logout antes do return
code = code.replace(
  'return (',
  `async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (`
);

// Adiciona botão sair no sidebar
code = code.replace(
  '>Administrador</div>',
  '>Administrador</div><button onClick={logout} style={{marginTop:8,width:"100%",padding:"6px",borderRadius:6,border:"1px solid #fecaca",background:"#fff5f5",fontSize:11,color:"#ef4444",cursor:"pointer",fontWeight:600}}>Sair</button>'
);

fs.writeFileSync('app/dashboard/page.tsx', code, 'utf8');
console.log('Logout adicionado!');
