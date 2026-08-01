import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import path from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "uploads";

let cachedClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Faltan las variables de entorno SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }
  return cachedClient;
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// `folder` agrupa los archivos dentro del bucket (ej. "characters", "beasts"),
// igual que antes se agrupaban en subcarpetas dentro de /uploads.
export async function uploadImageToSupabase(
  folder: string,
  file: Express.Multer.File
): Promise<string> {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new Error("Solo se permiten imágenes JPG, PNG, WEBP o GIF.");
  }

  const extension = path.extname(file.originalname).toLowerCase() || ".jpg";
  const fileName = `${folder}/${Date.now()}-${crypto.randomUUID()}${extension}`;

  const supabase = getSupabaseClient();

  const { error } = await supabase.storage.from(BUCKET).upload(fileName, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });

  if (error) {
    throw new Error(`No se pudo subir la imagen a Supabase: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}