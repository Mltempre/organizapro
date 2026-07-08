import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OrganizaPro",
  description: "O primeiro Diretor Digital para pequenas empresas de serviços.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{margin:0,padding:0,fontFamily:"Inter, sans-serif"}}>{children}</body>
    </html>
  );
}
