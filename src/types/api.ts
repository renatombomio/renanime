import type { AnimeEntry } from "./anime";

export interface AnimeSearchOptions {
  query: string;
  page?: number;
  perPage?: number;
}

export interface AnimeProvider {
  search(options: AnimeSearchOptions): Promise<AnimeEntry[]>;
  getById(id: number): Promise<AnimeEntry | null>;
}
