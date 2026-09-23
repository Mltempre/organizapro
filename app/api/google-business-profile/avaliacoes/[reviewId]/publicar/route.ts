import { NextRequest } from "next/server";
import { escreverGoogle } from "../../../../../../lib/google-business-profile-handlers";

export async function POST(req: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) {
  return escreverGoogle(req, "resposta", (await params).reviewId);
}
