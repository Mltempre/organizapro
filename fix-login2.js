const fs = require('fs');
let code = fs.readFileSync('app/login/page.tsx', 'utf8');
code = code.replace(
  'if (data.session) { router.push("/"); }',
  'if (data.session) { window.location.href = "/"; }'
);
fs.writeFileSync('app/login/page.tsx', code, 'utf8');
console.log('Login corrigido!');
