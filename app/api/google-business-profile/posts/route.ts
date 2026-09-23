import { NextRequest } from "next/server";
import { escreverGoogle } from "../../../../lib/google-business-profile-handlers";

export async function POST(req: NextRequest) { return escreverGoogle(req, "post"); }
