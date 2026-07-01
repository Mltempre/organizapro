-- Tabela de leads capturados pelo chatbot SDR
create table if not exists public.chatbot_leads (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  clinica_id        uuid not null,
  telefone          text not null,
  nome              text,
  cidade            text,
  especialidade     text,
  pacientes_mes     text,
  interesse         text,
  mensagem_original text,
  status            text not null default 'novo',
  constraint chatbot_leads_clinica_telefone unique (clinica_id, telefone)
);

-- Atualiza updated_at automaticamente
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger chatbot_leads_updated_at
  before update on public.chatbot_leads
  for each row execute function public.set_updated_at();

-- RLS: apenas service role acessa (anon bloqueado)
alter table public.chatbot_leads enable row level security;
