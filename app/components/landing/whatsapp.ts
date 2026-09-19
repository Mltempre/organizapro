// Número comercial oficial da OrganizaPro (já usado em toda a landing
// anterior — mantido sem alteração, não é dado fictício).
const NUMERO_COMERCIAL = "5541988379119";

export function abrirWhatsapp(mensagem = "Quero um Diretor Digital cuidando do meu negócio") {
  window.open(`https://wa.me/${NUMERO_COMERCIAL}?text=${encodeURIComponent(mensagem)}`, "_blank");
}

export function linkWhatsapp(mensagem: string) {
  return `https://wa.me/${NUMERO_COMERCIAL}?text=${encodeURIComponent(mensagem)}`;
}
