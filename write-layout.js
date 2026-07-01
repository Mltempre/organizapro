const fs = require('fs');
const code = `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BOLÃO SHORTS AI",
  description: "Plataforma de gestao para clinicas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{margin:0,padding:0,fontFamily:"Inter, sans-serif"}}>{children}</body>
    </html>
  );
}`;
fs.writeFileSync('app/layout.tsx', code, 'utf8');
console.log('Layout corrigido!');
