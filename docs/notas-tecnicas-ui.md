# Notas Técnicas — Componentes de UI (localStorage)

Registro de componentes de interface que usam `localStorage` para estado local (sem tabela/API própria), para evitar colisão de chaves em implementações futuras.

| Componente | Arquivo | Chave localStorage | Finalidade |
|---|---|---|---|
| Onboarding Premium (tela de boas-vindas) | `app/components/onboarding/WelcomeModal.tsx` | `op_welcome_modal_visto_${clinicaId}` | Marca que a empresa já viu a tela de boas-vindas no primeiro acesso, exibida uma única vez no Dashboard (`app/dashboard/page.tsx`). |
| Onboarding (checklist funcional) | `app/components/onboarding/OnboardingCard.tsx` | `op_onboarding_dashboard_visto_${clinicaId}` / `op_onboarding_concluido_recolhido_${clinicaId}` | Marca visita ao Dashboard e recolhimento do card ao concluir o checklist real de configuração. |
