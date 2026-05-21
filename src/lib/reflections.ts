// Full CRUD for reflections (private + community echoes).
import { supabase } from "@/integrations/supabase/client";

export type Reflection = {
  id: string;
  user_id: string;
  content: string;
  is_public: boolean;
  surah_id: number | null;
  ayah_number: number | null;
  created_at: string;
  updated_at?: string | null;
};

export type ReflectionInput = {
  content: string;
  is_public: boolean;
  surah_id?: number | null;
  ayah_number?: number | null;
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const MAX = 280;

export async function listMyReflections(
  userId: string,
  limit = 100,
): Promise<ApiResult<Reflection[]>> {
  try {
    const { data, error } = await supabase
      .from("reflections")
      .select("id,user_id,content,is_public,surah_id,ayah_number,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as Reflection[] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function listEchoes(
  limit = 50,
): Promise<ApiResult<Reflection[]>> {
  try {
    const { data, error } = await supabase
      .from("reflections")
      .select("id,user_id,content,is_public,surah_id,ayah_number,created_at")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as Reflection[] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function createReflection(
  userId: string,
  input: ReflectionInput,
): Promise<ApiResult<Reflection>> {
  const content = input.content.trim().slice(0, MAX);
  if (!content) return { ok: false, error: "Empty reflection" };
  try {
    const { data, error } = await supabase
      .from("reflections")
      .insert({
        user_id: userId,
        content,
        is_public: input.is_public,
        surah_id: input.surah_id ?? null,
        ayah_number: input.ayah_number ?? null,
      })
      .select("id,user_id,content,is_public,surah_id,ayah_number,created_at")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Failed" };
    return { ok: true, data: data as Reflection };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updateReflection(
  id: string,
  patch: Partial<ReflectionInput>,
): Promise<ApiResult<Reflection>> {
  const update: {
    content?: string;
    is_public?: boolean;
    surah_id?: number | null;
    ayah_number?: number | null;
  } = {};
  if (typeof patch.content === "string") {
    const c = patch.content.trim().slice(0, MAX);
    if (!c) return { ok: false, error: "Empty reflection" };
    update.content = c;
  }
  if (typeof patch.is_public === "boolean") update.is_public = patch.is_public;
  if (patch.surah_id !== undefined) update.surah_id = patch.surah_id;
  if (patch.ayah_number !== undefined) update.ayah_number = patch.ayah_number;
  try {
    const { data, error } = await supabase
      .from("reflections")
      .update(update)
      .eq("id", id)
      .select("id,user_id,content,is_public,surah_id,ayah_number,created_at")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Failed" };
    return { ok: true, data: data as Reflection };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function deleteReflection(id: string): Promise<ApiResult<true>> {
  try {
    const { error } = await supabase.from("reflections").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
