import type { MetadataRoute } from "next";
import { BASE_URL } from "./blog/data/articles";

// Blog e as landing pages de nicho (dentista/estetica/dermatologista) foram
// removidos do sitemap: as 3 landing pages foram aposentadas (redirect 301
// para "/" em next.config.js) e o blog foi despublicado temporariamente ate
// o conteudo ser reescrito para o posicionamento universal do OrganizaPro.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
  ];
}
