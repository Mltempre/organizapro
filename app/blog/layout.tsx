import type { Metadata } from "next";
import { BASE_URL } from "./data/articles";

export const metadata: Metadata = {
  title: {
    template: "%s | Blog OrganizaPro",
    default: "Blog OrganizaPro — Estratégias para Negócios com Agenda",
  },
  description:
    "Conteúdo especializado sobre WhatsApp, avaliações no Google, marketing e gestão automatizada para negócios locais que trabalham com agenda — clínicas, salões, escritórios, oficinas e mais.",
  keywords: [
    "blog para negócios locais",
    "whatsapp para pequenos negócios",
    "avaliações google negócio local",
    "marketing para pequenos negócios",
    "gestão de negócio com agenda",
    "automação para negócios locais",
    "reduzir faltas de clientes",
    "confirmar atendimentos automaticamente",
  ],
  authors: [{ name: "Equipe OrganizaPro", url: BASE_URL }],
  creator: "OrganizaPro",
  publisher: "OrganizaPro",
  metadataBase: new URL(BASE_URL),
  alternates: {
    canonical: `${BASE_URL}/blog`,
    languages: { "pt-BR": `${BASE_URL}/blog` },
  },
  openGraph: {
    type: "website",
    siteName: "OrganizaPro",
    locale: "pt_BR",
    url: `${BASE_URL}/blog`,
    title: "Blog OrganizaPro — Estratégias para Negócios com Agenda",
    description:
      "Guias práticos sobre WhatsApp, avaliações no Google, marketing e automação para negócios locais de qualquer segmento — de clínicas a barbearias, escritórios e oficinas.",
    images: [
      {
        url: `${BASE_URL}/og-blog.png`,
        width: 1200,
        height: 630,
        alt: "Blog OrganizaPro — Estratégias para Negócios com Agenda",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@organizapro",
    creator: "@organizapro",
    title: "Blog OrganizaPro — Estratégias para Negócios com Agenda",
    description:
      "Guias práticos sobre WhatsApp, avaliações no Google e automação para negócios locais com agenda.",
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
