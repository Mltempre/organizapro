const fs = require('fs');
const code = `import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    
    const data = await res.json();
    console.log("API response:", JSON.stringify(data).slice(0, 200));
    
    if (data.content && data.content[0]) {
      return NextResponse.json({ text: data.content[0].text });
    }
    return NextResponse.json({ text: "Erro: " + JSON.stringify(data) });
  } catch (e: any) {
    return NextResponse.json({ text: "Excecao: " + e.message });
  }
}`;
fs.writeFileSync('app/api/ia/route.ts', code, 'utf8');
console.log('Route corrigida!');
