import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../../lib/supabase-ssr";

export const prerender = false;

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind");

    if (!(file instanceof File) || (kind !== "avatar" && kind !== "cover")) {
      return json({ ok: false, error: "INVALID_UPLOAD" }, 400);
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return json({ ok: false, error: "FILE_SIZE_LIMIT" }, 413);
    }

    const extension = MIME_EXTENSIONS[file.type];
    if (!extension) return json({ ok: false, error: "UNSUPPORTED_IMAGE_TYPE" }, 415);

    const objectPath = `${auth.user.id}/${kind}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("profile-media")
      .upload(objectPath, file, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      console.warn("Profile media upload failed:", uploadError.message);
      return json({ ok: false, error: "UPLOAD_FAILED" }, 502);
    }

    const { data: publicData } = supabase.storage.from("profile-media").getPublicUrl(objectPath);
    const field = kind === "avatar" ? "avatar_url" : "cover_url";
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ [field]: publicData.publicUrl, updated_at: new Date().toISOString() })
      .eq("id", auth.user.id);

    if (updateError) {
      console.warn("Profile media URL update failed:", updateError.code);
      await supabase.storage.from("profile-media").remove([objectPath]);
      return json({ ok: false, error: "PROFILE_UPDATE_FAILED" }, 502);
    }

    return json({ ok: true, kind, url: publicData.publicUrl });
  } catch (error) {
    console.error("Profile media endpoint failed:", error);
    return json({ ok: false, error: "UPLOAD_UNAVAILABLE" }, 503);
  }
};
