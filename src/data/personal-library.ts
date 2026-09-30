import type { PersonalAnimeEntry, PersonalAnimeStatus } from "../types/personal";

const STORAGE_KEY = "renanime:personal-library:v1";
const CHANGE_EVENT = "renanime:personal-library-change";

function isBrowser() {
  return typeof window !== "undefined";
}

function read(): PersonalAnimeEntry[] {
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
  } catch {
    return [];
  }
}

function write(entries: PersonalAnimeEntry[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function getPersonalLibrary(): PersonalAnimeEntry[] {
  return read();
}

export function getPersonalEntry(animeId: string): PersonalAnimeEntry | null {
  return read().find((entry) => entry.animeId === animeId) ?? null;
}

export function addToPersonalList(animeId: string): PersonalAnimeEntry {
  const current = read();
  const existing = current.find((entry) => entry.animeId === animeId);

  if (existing) return existing;

  const entry: PersonalAnimeEntry = {
    animeId,
    state: {
      status: "PENDING",
      favorite: false,
      recommended: false,
    },
  };

  write([...current, entry]);
  return entry;
}

export function markPersonalWatched(animeId: string): PersonalAnimeEntry {
  const current = read();
  const existing = current.find((entry) => entry.animeId === animeId);

  const entry: PersonalAnimeEntry = existing
    ? {
        ...existing,
        state: {
          ...existing.state,
          status: "WATCHED",
        },
      }
    : {
        animeId,
        state: {
          status: "WATCHED",
          favorite: false,
          recommended: false,
        },
      };

  write([...current.filter((item) => item.animeId !== animeId), entry]);
  return entry;
}

export function setPersonalStatus(
  animeId: string,
  status: PersonalAnimeStatus,
) {
  if (status === "PENDING") return addToPersonalList(animeId);
  if (status === "WATCHED") return markPersonalWatched(animeId);

  removeFromPersonalLibrary(animeId);
  return null;
}

export function removeFromPersonalLibrary(animeId: string) {
  write(read().filter((entry) => entry.animeId !== animeId));
}

export function subscribeToPersonalLibrary(callback: () => void) {
  if (!isBrowser()) return () => undefined;

  const onChange = () => callback();
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };

  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
