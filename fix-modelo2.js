const fs = require('fs');
let code = fs.readFileSync('app/api/ia/route.ts', 'utf8');
code = code.replace('claude-haiku-4-5', 'claude-3-5-haiku-20241022');
fs.writeFileSync('app/api/ia/route.ts', code, 'utf8');
console.log('Modelo corrigido!');
