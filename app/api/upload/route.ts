import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "clinica-assets";
const SINGLE_TIPOS = ["logo", "hero"] as const;
const VALID_TIPOS  = ["logo", "hero", "galeria", "equipe", "antesdepois", "servico", "estrutura", "depoimento"] as const;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"]);
const ALLOWED_EXT  = new Set(["jpg", "jpeg", "png", "webp", "gif", "mp4"]);

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabaseAnon.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

    const formData = await req.formData();
    const file      = formData.get("file")      as File | null;
    const tipo      = formData.get("tipo")      as string | null;
    const clinicaId = formData.get("clinica_id") as string | null;

    if (!file || !tipo || !clinicaId) {
      return NextResponse.json({ error: "file, tipo e clinica_id são obrigatórios" }, { status: 400 });
    }
    if (!(VALID_TIPOS as readonly string[]).includes(tipo)) {
      return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Arquivo muito grande. Máximo 5MB." }, { status: 400 });
    }

    const ext  = (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: "Tipo de arquivo não permitido. Use JPG, PNG, WEBP, GIF ou MP4." }, { status: 400 });
    }
    const isSingle = (SINGLE_TIPOS as readonly string[]).includes(tipo);
    const filename = isSingle
      ? tipo
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const path = `${tipo}/${clinicaId}/${filename}.${ext}`;

    await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 5 * 1024 * 1024 }).catch(() => null);

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: isSingle });

    if (uploadError) {
      console.error("[upload] erro:", uploadError.message, { path });
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[upload] exceção:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
