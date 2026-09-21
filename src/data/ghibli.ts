export interface GhibliFilm {
  id: string;
  title: string;
  year: number;
  watched: boolean;
}

export const ghibliFilms: GhibliFilm[] = [
  { id: "nausica-of-the-valley-of-the-wind", title: "Nausicaä of the Valley of the Wind", year: 1984, watched: false },
  { id: "castle-in-the-sky", title: "Castle in the Sky", year: 1986, watched: false },
  { id: "my-neighbor-totoro", title: "My Neighbor Totoro", year: 1988, watched: true },
  { id: "grave-of-the-fireflies", title: "Grave of the Fireflies", year: 1988, watched: false },
  { id: "kiki-s-delivery-service", title: "Kiki's Delivery Service", year: 1989, watched: false },
  { id: "only-yesterday", title: "Only Yesterday", year: 1991, watched: false },
  { id: "porco-rosso", title: "Porco Rosso", year: 1992, watched: false },
  { id: "ocean-waves", title: "Ocean Waves", year: 1993, watched: false },
  { id: "pom-poko", title: "Pom Poko", year: 1994, watched: false },
  { id: "whisper-of-the-heart", title: "Whisper of the Heart", year: 1995, watched: false },
  { id: "princess-mononoke", title: "Princess Mononoke", year: 1997, watched: true },
  { id: "my-neighbors-the-yamadas", title: "My Neighbors the Yamadas", year: 1999, watched: false },
  { id: "spirited-away", title: "Spirited Away", year: 2001, watched: true },
  { id: "the-cat-returns", title: "The Cat Returns", year: 2002, watched: false },
  { id: "howl-s-moving-castle", title: "Howl's Moving Castle", year: 2004, watched: true },
  { id: "tales-from-earthsea", title: "Tales from Earthsea", year: 2006, watched: false },
  { id: "ponyo", title: "Ponyo", year: 2008, watched: true },
  { id: "arrietty", title: "Arrietty", year: 2010, watched: true },
  { id: "from-up-on-poppy-hill", title: "From Up on Poppy Hill", year: 2011, watched: false },
  { id: "the-wind-rises", title: "The Wind Rises", year: 2013, watched: false },
  { id: "the-tale-of-the-princess-kaguya", title: "The Tale of the Princess Kaguya", year: 2013, watched: false },
  { id: "when-marnie-was-there", title: "When Marnie Was There", year: 2014, watched: false },
  { id: "the-red-turtle", title: "The Red Turtle", year: 2016, watched: false },
  { id: "the-boy-and-the-heron", title: "The Boy and the Heron", year: 2023, watched: true },
];

export function getGhibliFilms(): GhibliFilm[] {
  return [...ghibliFilms];
}

export function getWatchedGhibliFilms(): GhibliFilm[] {
  return ghibliFilms.filter((film) => film.watched);
}

export function getUnwatchedGhibliFilms(): GhibliFilm[] {
  return ghibliFilms.filter((film) => !film.watched);
}
