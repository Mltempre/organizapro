import { NextResponse } from "next/server";
export { concluirMeta as GET } from "../../../../../lib/meta-ads-oauth";

export async function POST() { return NextResponse.json({ error: "Método não permitido" }, { status: 405 }); }