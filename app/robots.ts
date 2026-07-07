import type { MetadataRoute } from "next";
import { BASE_URL } from "./blog/data/articles";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/dashboard-demo",
          "/api/",
          "/api/chatbot",
          "/login",
          "/reset-password",
          "/configuracoes",
          "/agendamentos",
          "/automacao",
          "/conteudo",
          "/metricas",
          "/pacientes",
          "/reputacao",
          "/bolao",
          "/site",
          "/clinica/",
          "/chatbot",
          "/raio-x",
          "/landing",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
