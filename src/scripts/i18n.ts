type Language = "es" | "en";

const translations: Record<string, string> = {
  "Saltar al contenido": "Skip to content",
  "Inicio de Renanime": "Renanime home",
  "Navegación principal": "Main navigation",
  "Enlaces del pie de página": "Footer links",
  "Navegación móvil": "Mobile navigation",
  "Inicio": "Home",
  "Colección de Ren": "Ren's Collection",
  "Colección de Ren — Renanime's Gallery": "Ren's Collection — Renanime's Gallery",
  "Favoritos de Ren": "Ren's Favorites",
  "Géneros de Ren": "Ren's Genres",
  "Buscar": "Search",
  "Mi lista": "My List",
  "Mi colección": "My Collection",
  "Mi perfil": "My Profile",
  "El secreto de Ren": "Ren's Secret",
  "Favoritos": "Favorites",
  "Géneros": "Genres",
  "Acceso": "Sign in",
  "Entra en tu espacio personal de anime.": "Enter your personal anime space.",
  "Código de acceso": "Access code",
  "Entrar": "Enter",
  "¿Eres miembro de Renanime?": "Already a Renanime member?",
  "Entra con tu código de recuperación": "Sign in with your recovery code",
  "BIENVENIDO": "WELCOME",
  "¿Cómo te llamas?": "What's your name?",
  "Vamos a crear tu espacio personal.": "Let's create your personal space.",
  "Tu nombre": "Your name",
  "Continuar": "Continue",
  "¡SUBE DE RANGO, NAKAMA!": "LEVEL UP, NAKAMA!",
  "¿Cuál es tu mote otaku?": "What's your otaku nickname?",
  "¿Cómo te llamarían tus nakamas en el mundo del anime?": "What would your nakama call you in the anime world?",
  "Tu apodo legendario": "Your legendary nickname",
  "Vale, este es": "That's the one",
  "A nadie le importa tu mote, ": "Nobody cares about your nickname, ",
  "Ja, ja, ja… era broma. A nadie le importa tu mote, ": "Ha, ha, ha… just kidding. Nobody cares about your nickname, ",
  "No me puedo creer que lo hayas escrito… aunque tampoco tenías otra alternativa. Aquí yo soy ": "I can't believe you actually typed that… although you didn't have much choice. I'm the one in charge here: ",
  "Apunta tu código de recuperación:": "Write down your recovery code:",
  "Copiar código de recuperación": "Copy recovery code",
  "Haz clic para copiar": "Click to copy",
  "Copiar código": "Copy code",
  "Haz clic en el código o en el botón para copiarlo.": "Click the code or the button to copy it.",
  "¡Código copiado! Guárdalo en un lugar seguro.": "Code copied! Keep it somewhere safe.",
  "Código seleccionado. Pulsa Ctrl+C o ⌘C para copiarlo.": "Code selected. Press Ctrl+C or ⌘C to copy it.",
  "No se ha podido copiar automáticamente. Selecciona el código y cópialo.": "Couldn't copy automatically. Select the code and copy it.",
  "Guárdalo. Lo necesitarás para entrar desde otro dispositivo.": "Save it. You'll need it to sign in from another device.",
  "Iniciar sesión": "Sign in",
  "MIEMBRO DE RENANIME": "RENANIME MEMBER",
  "Volvamos a casa.": "Let's get you home.",
  "Introduce tu código de recuperación. No necesitas registrarte otra vez.": "Enter your recovery code. You don't need to register again.",
  "Código de recuperación": "Recovery code",
  "Entrar en mi cuenta": "Sign in to my account",
  "Soy nuevo, crear un perfil": "I'm new, create a profile",
  "Escribe tu nombre.": "Enter your name.",
  "Venga va. Dame un AKA.": "Come on, give me an AKA.",
  "¡Sé más creativo, tú puedes! ¡Gambare!": "Be more creative, you can do it! Gambare!",
  "Gambare Gambare Senpai": "Gambare, Gambare, Senpai",
  "No encuentro tu nombre. Vuelve atrás y escríbelo de nuevo.": "I can't find your name. Go back and enter it again.",
  "Escribe tu mote otaku.": "Enter your otaku nickname.",
  "No se han podido validar los datos. Prueba otro mote.": "We couldn't validate those details. Try another nickname.",
  "No se ha podido crear el perfil.": "Couldn't create your profile.",
  "Introduce tu código de recuperación.": "Enter your recovery code.",
  "Código de recuperación incorrecto.": "Incorrect recovery code.",
  "No se ha podido iniciar sesión.": "Couldn't sign in.",
  "No se ha podido conectar con Renanime.": "Couldn't connect to Renanime.",
  "Código de acceso incorrecto.": "Incorrect access code.",
  "No se ha podido abrir la puerta de Renanime.": "Couldn't open the door to Renanime.",
  "Introduce el código de acceso.": "Enter the access code.",
  "Alguien se ha olvidado del código de acceso.": "Someone forgot the access code.",
  "Renato no te quiere por aquí.": "Renato doesn't want you here.",
  "¿Seguro que sabes dónde estás?": "Are you sure you know where you are?",
  "Ese código no abre ni la nevera.": "That code wouldn't even open the fridge.",
  "RenAnime dice: acceso denegado.": "RenAnime says: access denied.",
  "Cerrar menú": "Close menu",
  "Abrir menú": "Open menu",
  "Galería personal de anime.": "Personal anime gallery.",
  "Anime a través de mis ojos.": "Anime through my eyes.",
  "Este es mi regalo para ti.": "This is my gift to you.",
  "Renanime's Gallery": "Renanime's Gallery",
  "MI HISTORIA CON GHIBLI": "MY STORY WITH GHIBLI",
  "EL SECRETO DE REN": "REN'S SECRET",
  "COLECCIÓN DE REN": "REN'S COLLECTION",
  "FAVORITOS DE REN": "REN'S FAVORITES",
  "GÉNEROS DE REN": "REN'S GENRES",
  "MI LISTA": "MY LIST",
  "MI COLECCIÓN": "MY COLLECTION",
  "MI PERFIL": "MY PROFILE",
  "INICIO": "HOME",
  "BUSCAR": "SEARCH",
  "El viaje de Chihiro fue la primera película de anime que vi.": "Spirited Away was the first anime film I watched.",
  "La primera película de anime que vi.": "The first anime film I watched.",
  "Desde entonces, Ghibli se convirtió en una forma de mirar el anime: naturaleza, imaginación, música y pequeñas historias que se quedan contigo.": "Since then, Ghibli has become a way of seeing anime: nature, imagination, music, and little stories that stay with you.",
  "Renanime's Gallery — Mi archivo personal de anime": "Renanime's Gallery — My Personal Anime Archive",
  "Galería personal de anime: favoritos, colección, géneros, pendientes.": "Personal anime gallery: favorites, collection, genres, and watchlist.",
  "Mi colección — Renanime's Gallery": "My Collection — Renanime's Gallery",
  "El archivo de las historias que ya forman parte de tu recorrido. Aquí no está Ren: este espacio empieza a ser tuyo desde el primer anime que ves.": "An archive of the stories that have become part of your journey. This isn't Ren's collection: this space becomes yours from the first anime you watch.",
  "Mi colección de anime": "My anime collection",
  "Favoritos de Ren — Renanime's Gallery": "Ren's Favorites — Renanime's Gallery",
  "No son simplemente los que más me gustan. Son los que dejaron algo detrás: una escena, un personaje, una idea o una sensación a la que siempre termino volviendo.": "They're not simply the ones I like most. They left something behind: a scene, a character, an idea, or a feeling I always find myself returning to.",
  "Géneros de Ren — Renanime's Gallery": "Ren's Genres — Renanime's Gallery",
  "Un mapa de lo que he visto. No es una lista universal de géneros: cada palabra aquí existe porque forma parte de mi colección.": "A map of what I've watched. This isn't a universal genre list: every word here belongs because it's part of my collection.",
  "Mi lista — Renanime's Gallery": "My List — Renanime's Gallery",
  "Las historias que has guardado para después. Este espacio es tuyo: descubre algo, guárdalo y vuelve cuando sea el momento.": "Stories you've saved for later. This space is yours: discover something, save it, and come back when the time is right.",
  "Anime pendiente": "Anime watchlist",
  "Buscar — Renanime's Gallery": "Search — Renanime's Gallery",
  "Explorar": "Explore",
  "Buscar anime": "Search anime",
  "Encuentra una historia y entra en su ficha.": "Find a story and open its details.",
  "Colección de Ren — Renanime's Gallery": "Ren's Collection — Renanime's Gallery",
  "La colección de Ren": "Ren's Collection",
  " animes vistos · Historias terminadas, descubrimientos y años de obsesión.": " anime watched · Finished stories, discoveries, and years of obsession.",
  "Colección de Ren": "Ren's Collection",
  "Mi perfil — Renanime's Gallery": "My Profile — Renanime's Gallery",
  "Tu perfil personal en Renanime.": "Your personal Renanime profile.",
  "MI PERFIL": "MY PROFILE",
  "Miembro de la comunidad otaku desde ": "Member of the otaku community since ",
  "MI RENANIME": "MY RENANIME",
  "ANIMES EN MI LISTA": "ANIME IN MY LIST",
  "ANIMES EN MI COLECCIÓN": "ANIME IN MY COLLECTION",
  "CÓDIGO DE RECUPERACIÓN": "RECOVERY CODE",
  "Guárdalo en un lugar seguro. Lo necesitarás para recuperar tu acceso desde otro dispositivo.": "Keep it somewhere safe. You'll need it to recover access from another device.",
  "Ver mi colección": "View my collection",
  "Ver mi lista": "View my list",
  "Cerrar sesión": "Sign out",
  "Todas las historias tienen un final.": "Every story has an ending.",
  "A veces amargo, otras placentero,": "Sometimes bitter, sometimes sweet,",
  "pero cada final solo trae nuevos comienzos.": "but every ending brings new beginnings.",
  "Gracias por visitar mi galería de Anime.": "Thanks for visiting my anime gallery.",
  "Bienvenidos a": "Welcome to",
  "Mi inicio en el anime.": "My beginning in anime.",
  "Mi rincón favorito del anime. Aquí escapo para conectar con la naturaleza, la música, la comida, lo simple, la VIDA.": "My favorite corner of anime. Here I escape to reconnect with nature, music, food, simplicity, and LIFE.",
  "Hecho de recuerdos, viento y películas.": "Made of memories, wind, and movies.",
  "El secreto de Ren · Mi viaje con Ghibli": "Ren's Secret · My Journey with Ghibli",
  "Cargando…": "Loading…",
  "Cargar más": "Load more",
  "Cargando mi biblioteca…": "Loading my library…",
  "Fecha desconocida": "Unknown date",
  "Tu recorrido": "Your journey",
  "Guardado para después": "Saved for later",
  "Algunas fichas no están disponibles ahora mismo. La biblioteca no se ha modificado.": "Some anime details are unavailable right now. Your library hasn't been changed.",
  "¿Qué, todavía no has visto anime?": "What, you haven't watched any anime yet?",
  "Esto está igual de vacío que tu corazón.": "This is as empty as your heart.",
  "¿No sabes lo que te estás perdiendo? Venga, anímate, que me hace falta más gente friki por aquí. 😂": "Don't know what you're missing? Come on, give it a try — I need more nerds around here. 😂",
  "Venga va, dame cariño y mete algún anime en la lista. Gracias. No leo lloros. 🫶": "Come on, show some love and add an anime to your list. Thanks. No whining. 🫶",
  "Explorar anime →": "Explore anime →",
  "Buscar algo que ver →": "Find something to watch →",
  "Ver ${title}": "View ${title}",
  "Sin título": "Untitled",
  "Todavía no hay una sinopsis disponible.": "No synopsis is available yet.",
  "Traducido al español": "Translated into Spanish",
  "Traducir al español": "Translate into Spanish",
  "Película": "Movie",
  "DURACIÓN": "RUNTIME",
  "DURACIÓN / EPISODIO": "RUNTIME / EPISODE",
  "Tráiler de ": "Trailer for ",
  "Navegar favoritos": "Browse favorites",
  "Favoritos anteriores": "Previous favorites",
  "Siguientes favoritos": "Next favorites",
  "Animes de género ": "Anime in the ",
  " géneros": " genres",
  "Buscar anime…": "Search anime…",
  "No se encontraron resultados.": "No results found.",
  "Cargando resultados…": "Loading results…",
  "Escribe el nombre de un anime": "Enter an anime title",
  "Añadir a mi lista": "Add to my list",
  "Añadido a mi lista": "Added to my list",
  "Quitar de mi lista": "Remove from my list",
  "Añadir a mi colección": "Add to my collection",
  "Añadido a mi colección": "Added to my collection",
  "Quitar de mi colección": "Remove from my collection",
  "Añadir a favoritos": "Add to favorites",
  "Quitar de favoritos": "Remove from favorites",
  "Ver detalles": "View details",
  "Ver ": "View ",
  "Sinopsis": "Synopsis",
  "Recomendaciones": "Recommendations",
  "Año": "Year",
  "Estado": "Status",
  "Formato": "Format",
  "Episodios": "Episodes",
  "Puntuación": "Rating",
  "Cargando detalles del anime…": "Loading anime details…",
  "No se ha podido cargar este anime.": "Couldn't load this anime.",
  "La primera película de anime que vi. Sin saberlo todavía, aquí empezó mi puerta de entrada a un mundo que acabaría formando parte de mí.": "The first anime film I ever watched. Without realizing it, this was the doorway into a world that would become part of me.",
  "Otra cara de Ghibli: belleza, amor y fantasía conviviendo con un mundo roto. Es de esas historias que parecen escapar de la realidad mientras hablan de ella.": "Another side of Ghibli: beauty, love, and fantasy coexisting with a broken world. One of those stories that seem to escape reality while talking about it.",
  "Información": "Information",
  "Traducir al inglés": "Translate into English",
  "Desliza para descubrir": "Scroll to discover",
  "Desliza para explorar": "Scroll to explore",
  "Ver anime": "View anime",
  "Explorar colección": "Explore collection",
  "Volver": "Back",
  "Volver al inicio": "Back to home",
  "Sin resultados": "No results",
  "No hay resultados para tu búsqueda.": "No results for your search.",
  "Buscar en AniList": "Search AniList",
  "Busca un anime por su título.": "Search for an anime by title.",
  "Selecciona un género": "Select a genre",
  "No hay animes en este género.": "There are no anime in this genre.",
  "Todavía no hay animes en tu colección.": "There are no anime in your collection yet.",
  "Todavía no has añadido animes a tu lista.": "You haven't added any anime to your list yet.",
  "LANZAMIENTO": "RELEASE DATE",
  "DURACIÓN": "RUNTIME",
  "Película": "Movie",
  "Serie": "Series",
  "Temporadas": "Seasons",
  "temporadas": "seasons",
  "Favorito": "Favorite",
  "Recomendado": "Recommended",
  "Tu colección": "Your collection",
  "Tu lista": "Your list",
  "Añadir": "Add",
  "Añadido": "Added",
  "Ya lo he visto": "I've watched it",
  "Ya la he visto": "I've watched it",
  "Ya lo he visto ✓": "Already watched ✓",
  "Añadir a mi lista": "Add to my list",
  "Buscar por título…": "Search by title…",
  "Busca por título…": "Search by title…",
  "Buscando…": "Searching…",
  "No encontramos resultados para ": "No results found for ",
  " restantes": " remaining",
  "Mi viaje": "My journey",
  "MI HISTORIA CON GHIBLI": "MY STORY WITH GHIBLI",
  "El viaje de Chihiro": "Spirited Away",
  "fue la primera película de anime que vi. Desde entonces, Ghibli se convirtió en una forma de mirar el anime: naturaleza, imaginación, música y pequeñas historias que se quedan contigo.": "was the first anime film I watched. Since then, Ghibli has become a way of seeing anime: nature, imagination, music, and little stories that stay with you.",
  "AHORA": "NOW",
  "MI VIAJE": "MY JOURNEY",
  "AÑADIR A MI LISTA": "ADD TO MY LIST",
  "YA LO HE VISTO": "ALREADY WATCHED",
  "INFORMACIÓN": "INFORMATION",
  "GÉNEROS": "GENRES",
  "SINOPSIS": "SYNOPSIS",
  "RECOMENDACIONES": "RECOMMENDATIONS",
  "ESTADO": "STATUS",
  "FORMATO": "FORMAT",
  "PUNTUACIÓN": "RATING",
  "Fecha de lanzamiento": "Release date",
  "Fecha de estreno": "Release date",
  "Duración": "Runtime",
  "Duración / episodio": "Runtime / episode",
  "Traducir descripción": "Translate description",
  "Ver tráiler": "Watch trailer",
  "No disponible": "Unavailable",
  "No hay información disponible.": "No information available.",
  "Colección personal": "Personal collection",
  "Lista personal": "Personal list",
  "Se ha añadido a tu lista.": "Added to your list.",
  "Se ha eliminado de tu lista.": "Removed from your list.",
  "Se ha añadido a tu colección.": "Added to your collection.",
  "Se ha eliminado de tu colección.": "Removed from your collection.",
  "Guardando…": "Saving…",
  "Error al guardar. Inténtalo de nuevo.": "Couldn't save. Try again."
};

const attributeTranslations: Record<string, string> = {
  "placeholder": "placeholder",
  "aria-label": "aria-label",
  "title": "title"
};

function translateValue(value: string, language: Language): string {
  let result = value;
  const entries = Object.entries(translations).sort((a, b) => b[0].length - a[0].length);
  for (const [spanish, english] of entries) {
    const from = language === "en" ? spanish : english;
    const to = language === "en" ? english : spanish;
    if (result.includes(from)) result = result.split(from).join(to);
  }
  return result;
}

function translateDocument(language: Language) {
  document.documentElement.lang = language;
  document.querySelectorAll<HTMLElement>("[data-language-toggle]").forEach((button) => {
    const toggleLabel = language === "es" ? "ES · EN" : "EN · ES";
    if (button.textContent !== toggleLabel) button.textContent = toggleLabel;
    button.setAttribute("aria-label", language === "es" ? "Switch language to English" : "Cambiar idioma a español");
    button.setAttribute("title", language === "es" ? "Switch to English" : "Cambiar a español");
    button.setAttribute("aria-pressed", String(language === "en"));
  });

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent || parent.closest("script, style, noscript, textarea, input, [data-no-translate], [data-language-toggle]")) continue;
    const value = node.nodeValue;
    if (value) {
      const translated = translateValue(value, language);
      if (translated !== value) node.nodeValue = translated;
    }
  }

  document.querySelectorAll<HTMLElement>("input[placeholder], textarea[placeholder], [aria-label], [title]").forEach((element) => {
    for (const attribute of Object.keys(attributeTranslations)) {
      const value = element.getAttribute(attribute);
      if (value) element.setAttribute(attribute, translateValue(value, language));
    }
  });

  const title = document.querySelector("title");
  if (title) title.textContent = translateValue(title.textContent ?? "", language);
  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (description?.content) description.content = translateValue(description.content, language);
}

let currentLanguage: Language = "es";
try {
  currentLanguage = localStorage.getItem("renanime-language") === "en" ? "en" : "es";
} catch {}

const applyLanguage = (language: Language) => {
  currentLanguage = language;
  try {
    localStorage.setItem("renanime-language", language);
  } catch {}
  translateDocument(language);
};

document.addEventListener("click", (event) => {
  const target = event.target;
  if (target instanceof Element && target.closest("[data-language-toggle]")) {
    event.preventDefault();
    applyLanguage(currentLanguage === "es" ? "en" : "es");
  }
});

const observer = new MutationObserver(() => {
  translateDocument(currentLanguage);
});
observer.observe(document.body, { childList: true, characterData: true, subtree: true });

document.addEventListener("astro:page-load", () => {
  try {
    currentLanguage = localStorage.getItem("renanime-language") === "en" ? "en" : "es";
  } catch {}
  translateDocument(currentLanguage);
});
translateDocument(currentLanguage);
