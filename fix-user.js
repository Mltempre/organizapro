const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://rxuedvrvujwlprsaprgn.supabase.co',
  'sb_publishable_4AYdEtqvf_oW91eT3BRfWA_wFMF1C8a'
);
async function main() {
  const { data, error } = await supabase.auth.signUp({
    email: 'admin@bolaoshorts.ai',
    password: 'clinica123',
    options: { emailRedirectTo: undefined, data: { confirmed: true } }
  });
  if (error) console.log('Erro:', error.message);
  else console.log('Resultado:', JSON.stringify(data.user?.email), 'confirmed:', data.user?.email_confirmed_at ? 'sim' : 'nao');
}
main();
