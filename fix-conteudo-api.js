const fs = require('fs');
let code = fs.readFileSync('app/conteudo/page.tsx', 'utf8');
code = code.replace(
  `const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompts[tipoSel.id] }],
        }),
      });
      const data = await res.json();
      setResultado(data.content?.[0]?.text || "Erro ao gerar conteúdo.");`,
  `const res = await fetch("/api/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompts[tipoSel.id] }),
      });
      const data = await res.json();
      setResultado(data.text || "Erro ao gerar conteúdo.");`
);
fs.writeFileSync('app/conteudo/page.tsx', code, 'utf8');
console.log('Conteudo atualizado para usar API route!');
