const fs = require('fs');
let code = fs.readFileSync('app/conteudo/page.tsx', 'utf8');
// Substitui qualquer chamada para anthropic por /api/ia
code = code.replace(/await fetch\("https:\/\/api\.anthropic\.com[^"]*"/g, 'await fetch("/api/ia"');
code = code.replace(/method: "POST",\s*headers: \{[^}]*"Content-Type"[^}]*"x-api-key"[^}]*\},\s*body: JSON\.stringify\(\{[^}]*messages[^}]*\}\)/gs, 'method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: prompts[tipoSel.id] })');
fs.writeFileSync('app/conteudo/page.tsx', code, 'utf8');
console.log('Feito!');
