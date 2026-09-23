import { NextResponse } from "next/server";
export { concluirGoogle as GET } from "../../../../../lib/google-business-profile-oauth";

export async function POST() { return NextResponse.json({ error: "Método não permitido" }, { status: 405 }); }
