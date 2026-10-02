const JIKAN_BASE = "https://api.jikan.moe/v4";

export async function fetchFallbackPoster(title: string): Promise<string | null> {
  const query = title.trim();
  if (!query) return null;
  try {
    const url = new URL(JIKAN_BASE + "/anime");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "5");
    const response = await fetch(url);
    if (!response.ok) return null;
    const payload = await response.json();
    const items = Array.isArray(payload?.data) ? payload.data : [];
    const normalized = query.toLocaleLowerCase("en");
    const exact = items.find((item: any) =>
      [item?.title, item?.title_english, ...(item?.title_synonyms ?? [])]
        .filter(Boolean)
        .some((value: string) => value.toLocaleLowerCase("en") === normalized)
    );
    const item = exact ?? items[0];
    return item?.images?.webp?.large_image_url
      || item?.images?.jpg?.large_image_url
      || item?.images?.webp?.image_url
      || item?.images?.jpg?.image_url
      || null;
  } catch {
    return null;
  }
}
