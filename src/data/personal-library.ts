import type { PersonalAnimeEntry, PersonalAnimeStatus } from "../types/personal";

const STORAGE_KEY = "renanime:personal-library:v1";
const CHANGE_EVENT = "renanime:personal-library-change";

let library: PersonalAnimeEntry[] = [];
let hydrated = false;
let hydrating: Promise<void> | null = null;

function isBrowser() { return typeof window !== "undefined"; }

function readLegacy(): PersonalAnimeEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is PersonalAnimeEntry => {
      if (!entry || typeof entry !== "object") return false;
      const value = entry as Partial<PersonalAnimeEntry>;
      return typeof value.animeId === "string" && Boolean(value.state);
    });
  } catch { return []; }
}

function notify() {
  if (isBrowser()) window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

async function request(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new Error("Biblioteca no disponible");
  return response.json();
}

export async function hydratePersonalLibrary() {
  if (!isBrowser() || hydrated) return;
  if (hydrating) return hydrating;

  hydrating = (async () => {
    try {
      const remote = await request("/api/library");
      library = Array.isArray(remote) ? remote : [];
      const legacy = readLegacy();

      if (legacy.length) {
        await request("/api/library", {
          method: "POST",
          body: JSON.stringify({ action: "sync", entries: legacy }),
        });
        const migrated = await request("/api/library");
        library = Array.isArray(migrated) ? migrated : library;
      }

      window.localStorage.removeItem(STORAGE_KEY);
      hydrated = true;
      notify();
    } catch {
      // Never delete legacy data when Supabase cannot be reached.
    } finally {
      hydrating = null;
    }
  })();

  return hydrating;
}

export function getPersonalLibrary(): PersonalAnimeEntry[] { return library; }

export function getPersonalEntry(animeId: string): PersonalAnimeEntry | null {
  return library.find((entry) => entry.animeId === animeId) ?? null;
}

async function save(entry: PersonalAnimeEntry): Promise<PersonalAnimeEntry> {
  const previous = getPersonalEntry(entry.animeId);
  library = [...library.filter((item) => item.animeId !== entry.animeId), entry];
  notify();

  try {
    const remote = await request("/api/library", {
      method: "POST",
      body: JSON.stringify({ entry }),
    });
    if (!remote?.ok || !remote.entry || remote.entry.animeId !== entry.animeId) {
      throw new Error("No se pudo confirmar el guardado en el servidor");
    }
    const saved = remote.entry as PersonalAnimeEntry;
    library = [...library.filter((item) => item.animeId !== entry.animeId), saved];
    notify();
    return saved;
  } catch (error) {
    library = previous
      ? [...library.filter((item) => item.animeId !== entry.animeId), previous]
      : library.filter((item) => item.animeId !== entry.animeId);
    notify();
    throw error;
  }
}

export async function addToPersonalList(animeId: string): Promise<PersonalAnimeEntry> {
  const existing = getPersonalEntry(animeId);
  if (existing) return existing;
  const entry: PersonalAnimeEntry = {
    animeId,
    state: { status: "PENDING", favorite: false, recommended: false },
  };
  return save(entry);
}

export async function markPersonalWatched(animeId: string): Promise<PersonalAnimeEntry> {
  const existing = getPersonalEntry(animeId);
  const entry = existing
    ? { ...existing, state: { ...existing.state, status: "WATCHED" as const } }
    : { animeId, state: { status: "WATCHED" as const, favorite: false, recommended: false } };
  return save(entry);
}

export async function setPersonalStatus(animeId: string, status: PersonalAnimeStatus) {
  if (status === "PENDING") return addToPersonalList(animeId);
  if (status === "WATCHED") return markPersonalWatched(animeId);
  await removeFromPersonalLibrary(animeId);
  return null;
}

export async function removeFromPersonalLibrary(animeId: string): Promise<void> {
  const previous = getPersonalEntry(animeId);
  library = library.filter((entry) => entry.animeId !== animeId);
  notify();

  try {
    const response = await fetch("/api/library?animeId=" + encodeURIComponent(animeId), {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error("No se pudo eliminar de la biblioteca");
  } catch (error) {
    if (previous) library = [...library.filter((entry) => entry.animeId !== animeId), previous];
    notify();
    throw error;
  }
}

export function subscribeToPersonalLibrary(callback: () => void) {
  if (!isBrowser()) return () => undefined;
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}
