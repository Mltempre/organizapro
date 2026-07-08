/** @type {import("next").NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Rota antiga do site publico do cliente (era /clinica/[id], nome
      // ligado ao vertical de saude do produto anterior). Preserva links
      // ja publicados por clientes atuais.
      { source: "/clinica/:id", destination: "/empresa/:id", permanent: true },
      // Landing pages de nicho aposentadas (OrganizaPro 1.0): o
      // posicionamento agora e universal, concentrado na home.
      { source: "/dentista", destination: "/", permanent: true },
      { source: "/dermatologista", destination: "/", permanent: true },
      { source: "/estetica", destination: "/", permanent: true },
    ];
  },
}
module.exports = nextConfig

// force redeploy 2026-06-24
