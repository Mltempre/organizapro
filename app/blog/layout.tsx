import type { Metadata } from "next";
import { BASE_URL } from "./data/articles";

export const metadata: Metadata = {
  title: {
    template: "%s | Blog ClínicaFlow",
    default: "Blog ClínicaFlow — Estratégias para Clínicas de Saúde",
  },
  description:
    "Conteúdo especializado sobre WhatsApp para clínicas, avaliações no Google, marketing para consultórios e gestão automatizada para profissionais de saúde.",
  keywords: [
    "blog clínicas de saúde",
    "whatsapp para clínicas",
    "avaliações google consultório",
    "marketing para dentistas",
    "gestão de clínicas",
    "automação clínica médica",
    "reduzir faltas pacientes",
    "confirmar consultas automaticamente",
  ],
  authors: [{ name: "Equipe ClínicaFlow", url: BASE_URL }],
  creator: "ClínicaFlow",
  publisher: "ClínicaFlow",
  metadataBase: new URL(BASE_URL),
  alternates: {
    canonical: `${BASE_URL}/blog`,
    languages: { "pt-BR": `${BASE_URL}/blog` },
  },
  openGraph: {
    type: "website",
    siteName: "ClínicaFlow",
    locale: "pt_BR",
    url: `${BASE_URL}/blog`,
    title: "Blog ClínicaFlow — Estratégias para Clínicas de Saúde",
    description:
      "Guias práticos sobre WhatsApp, avaliações no Google, marketing e automação para dentistas, dermatologistas, estetas e fisioterapeutas.",
    images: [
      {
        url: `${BASE_URL}/og-blog.png`,
        width: 1200,
        height: 630,
        alt: "Blog ClínicaFlow — Estratégias para Clínicas de Saúde",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@clinicaflow",
    creator: "@clinicaflow",
    title: "Blog ClínicaFlow — Estratégias para Clínicas de Saúde",
    description:
      "Guias práticos sobre WhatsApp, avaliações no Google e automação para clínicas de saúde.",
    images: [`${BASE_URL}/og-blog.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
