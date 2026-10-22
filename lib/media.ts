import { createClient } from "@/lib/supabase/server";

export type MediaAsset = {
  placement: string;
  url: string;
  kind: "image" | "video";
};

/**
 * Read uploaded media assets for public page slots. Missing rows simply mean
 * the slot falls back to its built-in placeholder. Fails closed (empty map)
 * if the table does not exist yet.
 */
export async function getMediaAssets(
  placements: string[],
): Promise<Record<string, MediaAsset>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_assets")
    .select("placement, url, kind")
    .in("placement", placements);

  const map: Record<string, MediaAsset> = {};
  if (!error && data) {
    for (const row of data) {
      map[row.placement] = {
        placement: row.placement,
        url: row.url,
        kind: row.kind as "image" | "video",
      };
    }
  }
  return map;
}
