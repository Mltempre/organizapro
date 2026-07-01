const fs = require('fs');
const code = `import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);`;
fs.writeFileSync('lib/supabase.ts', code, 'utf8');
console.log('Supabase client corrigido!');
