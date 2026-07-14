# Scripts OrganizaPro

## implantar-cliente.mjs

Script oficial para implantar novos clientes sem acesso manual ao Supabase.

### Pré-requisito

O arquivo `.env.local` na raiz do projeto deve conter:

```
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
NEXT_PUBLIC_APP_URL=https://app.organizapro.com.br
```

`SUPABASE_SERVICE_ROLE_KEY` é obrigatório — sem ele o script não inicia.

### Como executar

```bash
# Testar se o ambiente está configurado (sem alterar nada no banco)
node scripts/implantar-cliente.mjs --dry-run

# Implantar um novo cliente
node scripts/implantar-cliente.mjs
```

O script pedirá no terminal:

| Campo | Obrigatório | Exemplo |
|---|---|---|
| Nome do negócio | Sim | `Escritório Silva Advocacia` |
| E-mail do administrador | Sim | `silva@advocacia.com.br` |
| Senha temporária | Sim (mín. 6 chars) | `Acesso@2026` |
| WhatsApp | Não | `41999999999` |
| Slug | Sim | `escritorio-silva` |

### O que o script faz

Executa 5 etapas em sequência, com rollback automático em caso de falha:

1. **Cria o usuário** em `auth.users` via `supabase.auth.admin.createUser` — e-mail já confirmado, sem necessidade de link de verificação
2. **Cria o perfil** em `usuarios` com o mesmo ID do usuário autenticado
3. **Cria a empresa** em `clinicas` com nome e WhatsApp
4. **Cria o vínculo ativo** em `clinica_usuarios` (usuario_id → clinica_id), com o papel padrão `recepcionista`
5. **Cria a configuração inicial** em `clinica_config`, incluindo o slug público

### O que conferir depois

- [ ] Usuário consegue acessar `/login` com o e-mail e senha informados
- [ ] Dashboard exibe os dados do negócio (não aparece vazio)
- [ ] `/configuracoes` exibe o nome do negócio pré-preenchido
- [ ] Slug acessível em `/empresa/<slug>`

### Rollback automático

Se qualquer etapa falhar após o usuário ser criado, o script remove configuração, vínculo, empresa, perfil e usuário Auth criados, em ordem segura, para não deixar dados inconsistentes no banco.
