// WhatsApp Business oficial do OrganizaPro — (43) 98412-8591, confirmado pelo
// responsável em 2026-09-26. Fonte ÚNICA para landing, blog e chatbot SDR:
// o número anterior (41) pertence à ClínicaFlow e não pode aparecer aqui.
export const NUMERO_COMERCIAL = "5543984128591";
export const NUMERO_COMERCIAL_EXIBICAO = "43 98412-8591";

export function abrirWhatsapp(mensagem = "Quero um Diretor Digital cuidando do meu negócio") {
  window.open(`https://wa.me/${NUMERO_COMERCIAL}?text=${encodeURIComponent(mensagem)}`, "_blank");
}

export function linkWhatsapp(mensagem: string) {
  return `https://wa.me/${NUMERO_COMERCIAL}?text=${encodeURIComponent(mensagem)}`;
}
