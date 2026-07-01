-- Adiciona colunas SDR ao chatbot_leads (execute após 20260624000000)
alter table public.chatbot_leads
  add column if not exists score text not null default 'frio',
  add column if not exists etapa text not null default 'inicial',
  add column if not exists dor   text;
