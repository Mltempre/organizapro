import { NextResponse } from "next/server";
export { iniciarMeta as POST } from "../../../../../lib/meta-ads-oauth";

export async function GET() { return NextResponse.json({ error: "Use POST autenticado para iniciar a conexão." }, { status: 405 }); }