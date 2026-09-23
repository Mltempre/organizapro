import { NextResponse } from "next/server";
export { iniciarGoogle as POST } from "../../../../../lib/google-business-profile-oauth";

export async function GET() { return NextResponse.json({ error: "Use POST autenticado para iniciar a conexão." }, { status: 405 }); }
