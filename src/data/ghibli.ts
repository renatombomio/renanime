export interface GhibliFilm {
  id: string;
  title: string;
  year: number;
  watched: boolean;
}

export interface GhibliStoryEntry {
  id: string;
  title: string;
  year: number;
  director: string;
  chapter: string;
  renText: string;
  creatorContext: string;
}

export const ghibliFilms: GhibliFilm[] = [
  { id: "nausica-of-the-valley-of-the-wind", title: "Nausicaä of the Valley of the Wind", searchTitle: "Nausicaa of the Valley of the Wind", year: 1984, watched: false },
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
  { id: "the-red-turtle", title: "The Red Turtle", searchTitle: "Red Turtle", year: 2016, watched: false },
  { id: "the-boy-and-the-heron", title: "The Boy and the Heron", year: 2023, watched: true },
];

export const ghibliStory: GhibliStoryEntry[] = [
  {
    id: "spirited-away",
    title: "Spirited Away",
    year: 2001,
    director: "Hayao Miyazaki",
    chapter: "El comienzo",
    renText: "La primera película de anime que vi. Sin saberlo todavía, aquí empezó mi puerta de entrada a un mundo que acabaría formando parte de mí.",
    creatorContext: "Miyazaki concibió la película pensando en cinco niñas de unos diez años, hijas de amigos suyos, y quiso hacer para ellas una historia en la que una chica corriente pudiera reconocerse y descubrir una fuerza que ya llevaba dentro.",
  },
  {
    id: "my-neighbor-totoro",
    title: "My Neighbor Totoro",
    year: 1988,
    director: "Hayao Miyazaki",
    chapter: "La infancia y la naturaleza",
    renText: "Después llegaron otras películas y descubrí que Ghibli no era solo fantasía: también era una forma distinta de mirar la naturaleza, la familia y las pequeñas cosas.",
    creatorContext: "Miyazaki explicó que quería expresar su amor y aprecio por la naturaleza, recuperando además paisajes y recuerdos de su propia infancia para construir el mundo de Satsuki y Mei.",
  },
  {
    id: "princess-mononoke",
    title: "Princess Mononoke",
    year: 1997,
    director: "Hayao Miyazaki",
    chapter: "La naturaleza no es un decorado",
    renText: "Aquí el viaje se volvió más profundo. Ghibli podía hablar de la humanidad y de la naturaleza sin convertir el mundo en una historia de buenos contra malos.",
    creatorContext: "Miyazaki quiso alejarse de una visión simplista de humanos contra naturaleza. La película enfrenta a personas, seres vivos, tierra, agua y aire, y deja abierto el problema de cómo convivir con nuestras propias contradicciones.",
  },
  {
    id: "howl-s-moving-castle",
    title: "Howl's Moving Castle",
    year: 2004,
    director: "Hayao Miyazaki",
    chapter: "Amor en tiempos de guerra",
    renText: "Otra cara de Ghibli: belleza, amor y fantasía conviviendo con un mundo roto. Es de esas historias que parecen escapar de la realidad mientras hablan de ella.",
    creatorContext: "Miyazaki adaptó la novela de Diana Wynne Jones y la película quedó profundamente marcada por su rechazo a la guerra de Irak y por su preocupación ante la destrucción y la violencia.",
  },
  {
    id: "ponyo",
    title: "Ponyo",
    year: 2008,
    director: "Hayao Miyazaki",
    chapter: "Volver a mirar como un niño",
    renText: "Ponyo recuerda que Ghibli también puede ser pura emoción: agua, color, movimiento y una imaginación que no necesita explicarlo todo.",
    creatorContext: "Miyazaki quería hacer una película dirigida especialmente a niños pequeños. La inspiración inicial surgió de una imagen ligada al mar, y el paisaje de Tomonoura, donde pasó tiempo durante el desarrollo, acabó formando parte del mundo de la película.",
  },
  {
    id: "arrietty",
    title: "Arrietty",
    year: 2010,
    director: "Hiromasa Yonebayashi",
    chapter: "Las cosas pequeñas",
    renText: "Una historia más íntima. El mundo se hace pequeño y, precisamente por eso, cada detalle empieza a importar más.",
    creatorContext: "Arrietty nació de un proyecto que Miyazaki y Isao Takahata habían considerado décadas antes a partir de The Borrowers, de Mary Norton. Miyazaki impulsó finalmente la adaptación y Yonebayashi la dirigió como su primer largometraje.",
  },
  {
    id: "the-boy-and-the-heron",
    title: "The Boy and the Heron",
    year: 2023,
    director: "Hayao Miyazaki",
    chapter: "Hasta ahora",
    renText: "Y llegué hasta aquí. El Niño y la Garza es, por ahora, la última película de Ghibli que forma parte de mi viaje. Cierra este primer capítulo, pero no el viaje.",
    creatorContext: "Miyazaki quiso contar aquí su propia historia de una forma que no había hecho antes. El protagonista masculino le permitió mirar hacia su infancia, la guerra, la familia y las personas que marcaron su vida, mientras convertía esos recuerdos en una fantasía.",
  },
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
