// Metricas -> consolidada no Raio-X da Empresa (bloco Gestao).
// Os contadores historicos exclusivos desta tela (concluidos, pendentes,
// cancelados e faltas, sem desfecho) foram absorvidos pelo Raio-X
// (app/raio-x/page.tsx + app/api/raio-x/route.ts). A rota NAO foi apagada:
// redirect permanente no servidor preserva links antigos (demo, robos,
// historico de navegacao).
import { redirect } from "next/navigation";

export default function MetricasPage() {
  redirect("/raio-x");
}