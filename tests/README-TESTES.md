# Testes — Smart Commerce (bloco sem migration)

Este projeto não tem test runner configurado (`package.json` não tem `jest`/`vitest`/script `test`).
Os testes aqui rodam com o test runner nativo do Node (`node:test`) contra o
JS **real**, compilado a partir do TypeScript — nunca uma reimplementação em paralelo.

## Como rodar

```bash
# 1. Compilar os módulos puros para um diretório fora do repositório
mkdir -p /tmp/smart-commerce-build
npx tsc --module commonjs --target es2020 --esModuleInterop --skipLibCheck --strict false \
  --outDir /tmp/smart-commerce-build \
  lib/oportunidades-clientes.ts lib/nucleo-inteligente.ts lib/recomendacoes.ts lib/chatbot-topico.ts lib/ia-comercial.ts lib/orcamentos-state-machine.ts \
  lib/motor-reputacao.ts lib/atribuicao-origem.ts lib/presenca-digital.ts

# 2. Rodar os testes apontando para o build (glob pega todos os arquivos de teste)
SMART_COMMERCE_BUILD_DIR=/tmp/smart-commerce-build node --test tests/*.test.mjs
```

No Windows (PowerShell), o passo 2 é:

```powershell
$env:SMART_COMMERCE_BUILD_DIR = "C:\tmp\smart-commerce-build"
node --test tests/oportunidades-clientes.smart-commerce.test.mjs tests/chatbot-topico.smart-commerce.test.mjs tests/orcamentos-state-machine.smart-commerce.test.mjs tests/motor-reputacao.test.mjs tests/atribuicao-origem.test.mjs tests/presenca-digital.test.mjs
```

Os testes do bloco Google Presença + Reputação + Demanda/Ads (ver
docs/google-presenca-reputacao-ads-v1-arquitetura.md) usam o sufixo
`.test.mjs` simples (sem `.smart-commerce.`) porque não pertencem àquele
bloco — mesma infraestrutura de teste (`node:test` contra build real),
domínio diferente.

Se este projeto ganhar um test runner de verdade (jest/vitest) no futuro, estes
testes devem migrar para ele — o formato `node:test`/`assert` foi escolhido só
porque nenhum runner estava instalado neste worktree isolado.
