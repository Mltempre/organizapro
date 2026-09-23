import "server-only";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { assertGoogleEnv, decifrarRefreshToken } from "./google-business-profile";
import { obterAccessTokenValido, listarLocalizacoesGoogle } from "./google-business-profile-api";
import { recursoGoogle } from "./google-business-profile-resources";
import { ErroGoogle, respostaErroGoogle } from "./google-business-profile-errors";

export const adminGoogle = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export function falhaGoogle(error: unknown) {
  const { body, status } = respostaErroGoogle(error);
  return NextResponse.json(body, { status });
}
export async function conexaoGoogle(clinicaId: string) {
  const { data, error } = await adminGoogle.from("google_business_profile_connections")
    .select("google_account_name, google_location_name, google_location_title, refresh_token_ciphertext, connected_at, granted_scopes")
    .eq("clinica_id", clinicaId).maybeSingle();
  if (error) throw new ErroGoogle("PERSISTENCIA");
  if (!data) throw new ErroGoogle("DESCONECTADO");
  if (!data.google_account_name || !data.google_location_name) throw new ErroGoogle("SEM_LOCAL");
  let recurso;
  try { recurso = recursoGoogle(data.google_account_name, data.google_location_name); } catch { throw new ErroGoogle("RECURSO"); }
  let config;
  let refresh;
  try { config = assertGoogleEnv(); refresh = decifrarRefreshToken(data.refresh_token_ciphertext, config.encryptionSecret); }
  catch { throw new ErroGoogle("CONFIGURACAO"); }
  const accessToken = await obterAccessTokenValido(refresh, config);
  return { ...recurso, accessToken, local: data.google_location_title, conectadoEm: data.connected_at };
}
export async function confirmarLocalizacao(conexao: Awaited<ReturnType<typeof conexaoGoogle>>) {
  const locais = await listarLocalizacoesGoogle(conexao.accessToken, conexao.account);
  if (!locais.some((l) => l.name === conexao.location)) throw new ErroGoogle("RECURSO");
}
