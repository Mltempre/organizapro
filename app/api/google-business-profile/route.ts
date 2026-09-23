import { NextRequest } from "next/server";
import { lerGoogle } from "../../../lib/google-business-profile-handlers";

export async function GET(req: NextRequest) { return lerGoogle(req, "status"); }

export async function DELETE(req: NextRequest) { return lerGoogle(req, "desconectar"); }
