export interface HeroSlideConfig {
  id: string;
  anilistId: number;
  eyebrow: string;
  note: string;
}

export const heroSlides: HeroSlideConfig[] = [
  {
    id: "naruto",
    anilistId: 20,
    eyebrow: "A story about becoming",
    note: "Una historia que forma parte de mi viaje.",
  },
  {
    id: "one-piece",
    anilistId: 21,
    eyebrow: "A story about freedom",
    note: "Una aventura que parece no tener final.",
  },
  {
    id: "spirited-away",
    anilistId: 199,
    eyebrow: "A story about growing",
    note: "La película que abrió mi puerta al anime.",
  },
];
