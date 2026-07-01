const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://rxuedvrvujwlprsaprgn.supabase.co',
  'sb_publishable_4AYdEtqvf_oW91eT3BRfWA_wFMF1C8a'
);
async function main() {
  const { data, error } = await supabase.auth.signUp({
    email: 'admin@bolaoshorts.ai',
    password: 'clinica123'
  });
  if (error) console.log('Erro:', error.message);
  else console.log('Usuario criado:', data.user?.email);
}
main();
