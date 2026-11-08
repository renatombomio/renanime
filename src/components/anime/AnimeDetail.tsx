import { getRenAniListId } from "../../lib/api/ren-anime-identities";
import { getDisplayTitle, getNativeTitle } from "../../lib/anime/display-title";
import { useEffect, useState } from "react";
import type { LibraryEntry } from "../../types/personal";
import { getLibrary } from "../../data/library";
import { getPersonalFranchiseEntries } from "../../data/franchise";
import PersonalLibraryActions from "../personal-library/PersonalLibraryActions";
import { fetchFallbackPoster, selectBestAnimeCandidate } from "../../lib/api/poster-fallback";
import { fetchFallbackAnime } from "../../lib/api/anime-fallback";
import { useT, type Lang } from "../../i18n";
import AnimeComments from "./AnimeComments";
import ShareAnime from "./ShareAnime";
import CharacterCarousel from "./CharacterCarousel";

interface Media {
  id: number | string;
  title?: { romaji?: string|null; english?: string|null; native?: string|null };
  description?: string|null;
  genres?: string[];
  startDate?: { year?: number|null; month?: number|null; day?: number|null }|null;
  format?: string|null;
  status?: string|null;
  episodes?: number|null;
  duration?: number|null;
  studios?: { nodes?: { name:string }[] };
  coverImage?: { extraLarge?: string|null; large?: string|null };
  bannerImage?: string|null;
  trailer?: { id?: string|null; site?: string|null; thumbnail?: string|null }|null;
  characters?: { edges?: { role?: string|null; node?: { id:number; name?: { full?:string|null }; image?: { large?:string|null } }|null }[] }|null;
  recommendations?: { nodes?: { mediaRecommendation?: { id:number; title?: { romaji?:string|null; english?:string|null; native?:string|null }; coverImage?: { extraLarge?:string|null; large?:string|null }; format?:string|null; startDate?: { year?:number|null }|null }|null }[] }|null;
  relations?: { edges?: { relationType?: string|null; node?: { id:number; type?:string|null; format?:string|null; title?: { romaji?:string|null; english?:string|null }; coverImage?: { extraLarge?:string|null; large?:string|null } } }[] }|null;
}

const ENDPOINT="https://graphql.anilist.co";
const FRANCHISE_CACHE_PREFIX="renanime:franchise:v1:";
const TRANSLATION_PREFIX="renanime:translation:en-es:v1:";
const FRANCHISE_MEDIA_ALIASES: Record<string, number> = {
  "movie-063": 178788,
};

function cleanDescription(text:string){
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\\+n/g, "\n")
    .replace(/\\+r/g, "\r")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitForTranslation(text:string){
  const chunks:string[]=[];
  let rest=text.trim();
  while(rest){
    if(new TextEncoder().encode(rest).length<=450){chunks.push(rest);break;}
    let cut=450;
    while(cut>100 && new TextEncoder().encode(rest.slice(0,cut)).length>450) cut-=10;
    const window=rest.slice(0,cut);
    const match=Math.max(window.lastIndexOf(". "),window.lastIndexOf("! "),window.lastIndexOf("? "));
    const boundary=match>120?match+1:window.lastIndexOf(" ");
    const size=boundary>120?boundary:cut;
    chunks.push(rest.slice(0,size).trim());
    rest=rest.slice(size).trim();
  }
  return chunks;
}

async function translateToSpanish(text:string){
  const clean=cleanDescription(text);
  if(!clean) return clean;
  try{
    const cached=sessionStorage.getItem(TRANSLATION_PREFIX+btoa(unescape(encodeURIComponent(clean))).slice(0,120));
    if(cached) return cached;
  }catch{}
  const chunks=splitForTranslation(clean);
  const translated:string[]=[];
  for(const chunk of chunks){
    try{
      const url="https://api.mymemory.translated.net/get?"+new URLSearchParams({q:chunk,langpair:"en|es",mt:"1"});
      const response=await fetch(url);
      if(!response.ok) throw new Error("translation");
      const payload=await response.json();
      translated.push(payload.responseData?.translatedText || chunk);
    }catch{ translated.push(chunk); }
  }
  const result=translated.join(" ");
  try{sessionStorage.setItem(TRANSLATION_PREFIX+btoa(unescape(encodeURIComponent(clean))).slice(0,120),result)}catch{}
  return result;
}





function getSeasonCount(media: Media|null){
  if(!media || media.format==="MOVIE") return null;
  const relatedTv=(media.relations?.edges??[])
    .filter((edge)=>edge.relationType==="PREQUEL"||edge.relationType==="SEQUEL")
    .filter((edge)=>edge.node?.format==="TV")
    .map((edge)=>edge.node?.id)
    .filter((id): id is number => typeof id==="number");
  return Math.max(1,new Set(relatedTv).size+1);
}

async function findAnime(entry: LibraryEntry): Promise<Media|null> {
  const numericId=Number(entry.animeId);
  const mediaId=getRenAniListId(entry.animeId) ?? FRANCHISE_MEDIA_ALIASES[entry.animeId] ?? (
    Number.isInteger(numericId) && numericId > 0 ? numericId : undefined
  );

  const query=mediaId
    ? `query DetailById($id:Int!){
        Media(id:$id,type:ANIME){
          id
          title{romaji english native}
          description(asHtml:false)
          genres
          startDate{year month day}
          format
          status
          episodes
          duration
          studios(isMain:true){nodes{name}}
          coverImage{extraLarge large}
          bannerImage
          trailer{id site thumbnail}
          characters(page:1,perPage:12,sort:ROLE){edges{role node{id name{full} image{large}}}}
          relations{
            edges{
              relationType
              node{
                id
                type
                format
                title{romaji english native}
                coverImage{extraLarge large}
              }
            }
          }
          recommendations(sort:RATING_DESC,page:1,perPage:12){
            nodes{
              mediaRecommendation{
                id
                title{romaji english native}
                coverImage{extraLarge large}
                format
                startDate{year}
              }
            }
          }
        }
      }`
    : `query DetailBySearch($search:String!){
        Page(page:1,perPage:1){
          media(search:$search,type:ANIME,sort:SEARCH_MATCH){
            id
            title{romaji english native}
            description(asHtml:false)
            genres
            startDate{year month day}
            format
            status
            episodes
            duration
            studios(isMain:true){nodes{name}}
            coverImage{extraLarge large}
            bannerImage
            trailer{id site thumbnail}
            characters(page:1,perPage:12,sort:ROLE){edges{role node{id name{full} image{large}}}}
            relations{
              edges{
                relationType
                node{
                  id
                  type
                  format
                  title{romaji english native}
                  coverImage{extraLarge large}
                }
              }
            }
            recommendations(sort:RATING_DESC,page:1,perPage:12){
              nodes{
                mediaRecommendation{
                  id
                  title{romaji english native}
                  coverImage{extraLarge large}
                  format
                  startDate{year}
                }
              }
            }
          }
        }
      }`;

  try{
    const response=await fetch(ENDPOINT,{
      method:"POST",
      headers:{"Content-Type":"application/json",Accept:"application/json"},
      body:JSON.stringify(
        mediaId
          ? {query,variables:{id:mediaId}}
          : {query,variables:{search:entry.title}}
      ),
    });
    if(!response.ok) throw new Error("AniList detail lookup failed");
    const payload=await response.json();
    const candidate = mediaId
      ? (payload.data?.Media ?? null)
      : selectBestAnimeCandidate(payload.data?.Page?.media ?? [], entry.title, entry.format);
    if (candidate) return candidate;
  }catch{
    // AniList unavailable or unable to identify the requested title: try Jikan.
  }

  return fetchFallbackAnime(entry.title, entry.format);
}

async function findAnimeBatch(entries: LibraryEntry[]): Promise<Record<string, Media|null>> {
  const result: Record<string, Media|null> = {};
  const unresolved: LibraryEntry[] = [];

  for (const entry of entries) {
    try {
      const cached = sessionStorage.getItem(FRANCHISE_CACHE_PREFIX + entry.animeId);
      if (cached) {
        const parsed = JSON.parse(cached) as Media|null;
        if (parsed) {
          result[entry.animeId] = parsed;
          continue;
        }
        sessionStorage.removeItem(FRANCHISE_CACHE_PREFIX + entry.animeId);
      }
    } catch {}
    unresolved.push(entry);
  }

  if (!unresolved.length) return result;

  // Resolve explicit AniList IDs separately. Mixing direct Media fields with
  // aliased Page fields made AniList reject the whole batch with HTTP 400.
  for (const entry of unresolved) {
    const directId = getRenAniListId(entry.animeId) ?? FRANCHISE_MEDIA_ALIASES[entry.animeId];
    if (!directId) continue;

    const query = `query FranchiseMediaById($id:Int!){Media(id:$id,type:ANIME){id title{romaji english native} synonyms description(asHtml:false) genres startDate{year month day} format status episodes duration studios(isMain:true){nodes{name}} coverImage{extraLarge large} bannerImage trailer{id site thumbnail}}}`;
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {"Content-Type":"application/json",Accept:"application/json"},
        body: JSON.stringify({query,variables:{id:directId}}),
      });
      if (!response.ok) continue;
      const payload = await response.json();
      const media = payload.data?.Media ?? null;
      if (media) {
        result[entry.animeId] = media;
        try { sessionStorage.setItem(FRANCHISE_CACHE_PREFIX + entry.animeId, JSON.stringify(media)); } catch {}
      }
    } catch {}

    if (!result[entry.animeId]) {
      const fallback = await fetchFallbackAnime(entry.title, entry.format);
      if (fallback) {
        result[entry.animeId] = fallback;
        try { sessionStorage.setItem(FRANCHISE_CACHE_PREFIX + entry.animeId, JSON.stringify(fallback)); } catch {}
      }
    }
  }

  const searchEntries = unresolved.filter((entry) => !FRANCHISE_MEDIA_ALIASES[entry.animeId]);
  if (!searchEntries.length) return result;

  // Keep search batches small to avoid AniList rejecting large aliased queries.
  const BATCH_SIZE = 5;

  for (let offset = 0; offset < searchEntries.length; offset += BATCH_SIZE) {
    const batch = searchEntries.slice(offset, offset + BATCH_SIZE);
    const variables: Record<string, string> = {};
    const fields = batch.map((entry, index) => {
      const key = "s" + index;
      const alias = "a" + index;
      variables[key] = entry.title;
      return alias + ": Page(page:1,perPage:10){media(search:$" + key + ",type:ANIME,sort:SEARCH_MATCH){id title{romaji english native} synonyms description(asHtml:false) genres startDate{year month day} format status episodes duration studios(isMain:true){nodes{name}} coverImage{extraLarge large} bannerImage trailer{id site thumbnail}}}";
    }).join("\n");
    const definitions = batch.map((_, index) => "$s" + index + ":String!").join(",");
    const query = `query FranchiseBatch(${definitions}){${fields}}`;

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {"Content-Type":"application/json",Accept:"application/json"},
        body: JSON.stringify({query,variables}),
      });

      if (!response.ok) continue;

      const payload = await response.json();

      for (const [index, entry] of batch.entries()) {
        const candidates = payload.data?.["a" + index]?.media ?? [];
        const media = selectBestAnimeCandidate(candidates, entry.title, entry.format);
        if (!media) {
          result[entry.animeId] = await fetchFallbackAnime(entry.title, entry.format);
        } else if (media.coverImage?.extraLarge || media.coverImage?.large) {
          result[entry.animeId] = media;
        } else {
          const poster = await fetchFallbackPoster(entry.title, entry.format, { skipAniList: true });
          result[entry.animeId] = poster
            ? { ...media, coverImage: { extraLarge: poster, large: poster } }
            : media;
        }

        if (result[entry.animeId]) {
          try {
            sessionStorage.setItem(FRANCHISE_CACHE_PREFIX + entry.animeId, JSON.stringify(result[entry.animeId]));
          } catch {}
        }
      }
    } catch {}
  }

  return result;
}

function date(value:Media["startDate"],lang:Lang="es"){
  if(!value?.year) return lang==="en"?"Unknown date":"Fecha desconocida";
  if(!value.month||!value.day) return String(value.year);
  return new Date(value.year,value.month-1,value.day).toLocaleDateString(lang==="en"?"en-GB":"es-ES",{day:"numeric",month:"long",year:"numeric"});
}

function format(value:string|null|undefined,lang:Lang){if(value==="MOVIE")return lang==="en"?"Movie":"Película";if(value==="TV")return lang==="en"?"Series":"Serie";return value||"Anime";}

export default function AnimeDetail({entry,lang="es"}:{entry:LibraryEntry;lang?:Lang}){
 const t=useT(lang);
 const[media,setMedia]=useState<Media|null>(null),[loading,setLoading]=useState(true),[translatedSynopsis,setTranslatedSynopsis]=useState(""),[translating,setTranslating]=useState(false),[franchiseMedia,setFranchiseMedia]=useState<Record<string,Media|null>>({}),[likeCount,setLikeCount]=useState(0),[liked,setLiked]=useState(false),[likeBusy,setLikeBusy]=useState(false),[likeNotice,setLikeNotice]=useState("");
 const cleanSynopsis=media?.description?cleanDescription(media.description):"";
 const hasSynopsis=cleanSynopsis.replace(/[\s\\n\\r]+/g,"").length>0;
 const franchiseEntries=getPersonalFranchiseEntries(entry,getLibrary());
 useEffect(()=>{
  let cancelled=false;
  findAnime(entry).then(value=>{
    if(cancelled)return;
    setMedia(value);
  }).finally(()=>{if(!cancelled)setLoading(false)});
  const franchiseCandidates=franchiseEntries.filter(candidate=>candidate.animeId!==entry.animeId);
  if(franchiseCandidates.length){
   findAnimeBatch(franchiseCandidates).then(results=>{
    if(cancelled)return;
    setFranchiseMedia(results);
   });
  }else{
   setFranchiseMedia({});
  }
  return()=>{cancelled=true};
 },[entry.animeId]);
 useEffect(()=>{
  if(typeof media?.id !== "number") return;
  let cancelled=false;
  fetch("/api/anime/likes?ids="+media.id,{credentials:"same-origin",cache:"no-store"})
   .then(response=>response.ok?response.json():null)
   .then(payload=>{
    if(cancelled||!payload?.likes?.[media.id]) return;
    setLikeCount(payload.likes[media.id].count||0);
    setLiked(Boolean(payload.likes[media.id].liked));
   }).catch(()=>{});
  return()=>{cancelled=true};
 },[media?.id]);
 const toggleLike=async()=>{
  if(typeof media?.id !== "number"||likeBusy) return;
  setLikeBusy(true); setLikeNotice("");
  try{
   const response=await fetch("/api/anime/likes",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({animeId:media.id})});
   const payload=await response.json().catch(()=>({}));
   if(response.status===401){setLikeNotice(lang==="en"?"Sign in to like this anime.":"Inicia sesión para dar like.");return;}
   if(!response.ok||!payload.ok) throw new Error("like_failed");
   setLiked(Boolean(payload.liked)); setLikeCount(Number(payload.count)||0);
  }catch{
   setLikeNotice(lang==="en"?"Could not update your like. Try again.":"No se pudo actualizar el like. Inténtalo de nuevo.");
  }finally{setLikeBusy(false)}
 };
 const translateSynopsis=async()=>{if(lang==="en"||!media?.description||translating)return;setTranslating(true);const value=await translateToSpanish(media.description);setTranslatedSynopsis(value);setTranslating(false)};
 const title=getDisplayTitle(media?.title,entry.title);
 const nativeTitle=getNativeTitle(media?.title);
 const poster=media?.coverImage?.extraLarge||media?.coverImage?.large;
 const banner=media?.bannerImage||poster;
 const personal=entry.state;
 const relations=(media?.relations?.edges??[]).filter(edge=>edge?.node?.type==="ANIME"&&edge.node.id!==media?.id);
 return <div className="anime-detail">
  <style>{`
    .anime-detail:not(.anime-detail--ghibli) .anime-detail-synopsis-wrap{max-width:42rem;margin-top:1.35rem;padding:1rem 0 1.1rem;border:0;border-radius:0;background:transparent;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none}
    .anime-detail:not(.anime-detail--ghibli) .anime-detail-synopsis{margin:0;color:var(--color-paper-50)}
    .anime-detail:not(.anime-detail--ghibli) .anime-detail-translate{border-color:rgba(245,242,236,.28);background:rgba(245,242,236,.06);color:var(--color-paper-200)}
    .anime-detail-poster{position:relative}\n    .anime-detail-native-title{margin:.35rem 0 0;color:var(--color-muted-400);font-family:"Hiragino Sans","Noto Sans JP",sans-serif;font-size:.82rem;line-height:1.4;letter-spacing:.04em}
    .anime-detail-like{position:absolute;right:.55rem;bottom:.55rem;z-index:3;display:inline-flex;align-items:center;gap:.35rem;padding:.45rem .6rem;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(0,0,0,.72);color:#fff;font:inherit;font-size:.72rem;backdrop-filter:blur(8px);cursor:pointer}
    .anime-detail-like svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    .anime-detail-like.is-liked{color:#ff4f91;border-color:rgba(255,79,145,.5)}
    .anime-detail-like.is-liked svg{fill:currentColor}
    .anime-detail-like:disabled{opacity:.55;cursor:wait}
    .anime-detail-like-notice{margin:.45rem 0 0;color:#f3a3bd;font-size:.72rem}
    .anime-detail-characters{grid-column:1/-1;width:100%;min-width:0;margin-top:1.45rem}
    .anime-detail-characters-track{display:flex;gap:.7rem;overflow-x:auto;padding:.2rem 0 .7rem;scroll-snap-type:x mandatory;scrollbar-width:thin;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}
    .anime-detail-character{flex:0 0 104px;min-width:0;scroll-snap-align:start}
    .anime-detail-character-image{aspect-ratio:3/4;overflow:hidden;border:1px solid rgba(255,255,255,.12);border-radius:9px;background:#171717}
    .anime-detail-character-image img{display:block;width:100%;height:100%;object-fit:cover}
    .anime-detail-character-name{display:block;margin-top:.45rem;color:var(--color-paper-100);font-size:.7rem;line-height:1.25;font-weight:600}
    .anime-detail-character-role{display:block;margin-top:.2rem;color:var(--color-muted-400);font-size:.55rem;text-transform:uppercase;letter-spacing:.06em}
    .anime-detail-share-wrap{margin-top:.85rem}
    .anime-detail-recommendations{grid-column:1 / -1;margin-top:2rem;width:100%;min-width:0}
    .anime-detail-recommendations-head{margin-bottom:.8rem}
    .anime-detail-recommendations-track{display:flex;gap:.7rem;min-height:0;overflow-x:auto;padding:.15rem 0 .65rem;scroll-snap-type:x mandatory;scrollbar-width:thin;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}
    .anime-detail-recommendation{flex:0 0 clamp(116px,30vw,138px);scroll-snap-align:start;color:inherit;text-decoration:none}
    .anime-detail-recommendation-poster{aspect-ratio:2/3;overflow:hidden;background:#171717;border-radius:8px;border:1px solid rgba(255,255,255,.14)}
    .anime-detail-recommendation-poster img{display:block;width:100%;height:100%;object-fit:cover;transition:transform 320ms cubic-bezier(.22,1,.36,1)}
    .anime-detail-recommendation:hover .anime-detail-recommendation-poster img{transform:scale(1.035)}
    .anime-detail-recommendation-title{display:block;margin-top:.48rem;font-size:.72rem;line-height:1.25;font-weight:500}
    .anime-detail-recommendation-meta{display:block;margin-top:.22rem;font-family:var(--font-meta);font-size:.5rem;letter-spacing:.06em;text-transform:uppercase;opacity:.58}
    @media(max-width:760px){.anime-detail:not(.anime-detail--ghibli) .anime-detail-synopsis-wrap{margin-top:1rem;padding:.85rem .9rem .95rem;border-radius:12px}.anime-detail-recommendations{grid-column:1 / -1;width:100%;margin-top:1.35rem}.anime-detail-recommendations-track{width:100%;max-width:none}.anime-detail-recommendation{flex:0 0 104px}.anime-detail-recommendation-title{font-size:.68rem}}
  `}</style>
  <section className="anime-detail-hero" style={banner?{backgroundImage:`linear-gradient(90deg,rgba(9,9,9,.98) 0%,rgba(9,9,9,.78) 43%,rgba(9,9,9,.35) 72%,rgba(9,9,9,.72) 100%),linear-gradient(0deg,rgba(9,9,9,.98),transparent 42%),url("${banner}")`}:undefined}>
   <div className="anime-detail-inner">
    <div className="anime-detail-layout">
      <div className="anime-detail-poster-column">
      <div className="anime-detail-poster">{poster?<img src={poster} alt={title}/>:<div className="anime-detail-placeholder">RENANIME</div>}
        {typeof media?.id === "number"&&<button type="button" className={"anime-detail-like"+(liked?" is-liked":"")} onClick={toggleLike} disabled={likeBusy} aria-pressed={liked} aria-label={liked?(lang==="en"?"Unlike anime":"Quitar like"):(lang==="en"?"Like anime":"Dar like")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.8c0 5.2-8.8 10-8.8 10s-8.8-4.8-8.8-10a4.6 4.6 0 0 1 8.8-1.9 4.6 4.6 0 0 1 8.8 1.9Z"/></svg><span>{likeCount.toLocaleString(lang==="en"?"en":"es")}</span></button>}
       </div>
       {likeNotice&&<p className="anime-detail-like-notice" role="status">{likeNotice}</p>}
       {media?.id && <div className="anime-detail-library-actions"><PersonalLibraryActions animeId={entry.animeId} lang={lang} /></div>}
      </div>
      <div className="anime-detail-copy">
       <div className="anime-detail-copy-main">
       {personal.favorite&&<span className="anime-detail-eyebrow">{t("detail.favorite")}</span>}
       <h1>{title}</h1>
        {typeof media?.id === "number" && <ShareAnime title={title} animeId={media.id} lang={lang} />}
        {nativeTitle&&<p className="anime-detail-native-title" lang="ja">{nativeTitle}</p>}
       <div className="anime-detail-meta">
  <span className="anime-detail-meta-type"><strong>{format(entry.format||media?.format,lang)}</strong></span>
  <span><small>{t("detail.release")}</small><strong>{date(media?.startDate,lang)}</strong></span>
  {media?.format!=="MOVIE"&&media?.episodes&&<span><small>{t("detail.episodes")}</small><strong>{media.episodes}</strong></span>}
  {media?.duration&&<span><small>{media?.format==="MOVIE"?t("detail.duration"):t("detail.durationEpisode")}</small><strong>{media.duration} min</strong></span>}
  {media?.format!=="MOVIE"&&getSeasonCount(media)&&<span><small>{t("detail.seasons")}</small><strong>{getSeasonCount(media)}</strong></span>}
</div>
       {media?.genres?.length&&<div className="anime-detail-genres">{media.genres.slice(0,5).map((genre)=><span key={genre}>{genre}</span>)}</div>}
       </div>
      </div>
       <div className="anime-detail-synopsis-wrap">
        <span className="anime-detail-label">{t("detail.synopsis")}</span>
        <p className="anime-detail-synopsis">{loading?t("detail.loading"):(lang==="es"&&translatedSynopsis)||cleanSynopsis||t("detail.noSynopsis")}</p>
        {lang==="es"&&hasSynopsis&&media?.description&&<button type="button" className="anime-detail-translate" onClick={translateSynopsis} disabled={translating}>{translating?t("detail.translating"):translatedSynopsis?t("detail.translated"):t("detail.translate")}</button>}
       </div>
       {media?.trailer?.id&&media.trailer.site==="youtube"&&<section className="anime-detail-trailer">
        <span className="anime-detail-label">{t("detail.trailer")}</span>
        <div className="anime-detail-video"><iframe src={"https://www.youtube.com/embed/"+media.trailer.id+"?rel=0"} title={(lang==="en"?"Trailer for ":"Tráiler de ")+title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>
       </section>}
       {typeof media?.id === "number" && <CharacterCarousel animeId={media.id} lang={lang} />}
       {typeof media?.id === "number" && <AnimeComments animeId={media.id} lang={lang} />}
    </div>
   </div>
  </section>
  <section className="anime-detail-info">
   <div><span className="anime-detail-label">{t("detail.information")}</span><strong>{media?.studios?.nodes?.map(s=>s.name).join(" · ")||t("detail.studioUnavailable")}</strong></div>
   <div><span className="anime-detail-label">{t("detail.myStatus")}</span><strong>{personal.status==="WATCHED"?t("detail.watched"):personal.status==="PENDING"?t("detail.wantToWatch"):t("detail.archive")}</strong></div>
  </section>
  {franchiseEntries.filter((candidate)=>candidate.animeId!==entry.animeId).length>0&&<section className="anime-detail-franchise">
   <div className="anime-detail-related-header"><span className="anime-detail-label">{t("detail.myCollection")}</span><h2>{t("detail.movies")}</h2></div>
   <div className="anime-detail-franchise-grid">
    {franchiseEntries.filter((candidate)=>candidate.animeId!==entry.animeId).map((candidate,index)=>{
      const item=franchiseMedia[candidate.animeId];
      const image=item?.coverImage?.extraLarge||item?.coverImage?.large;
      const candidateTitle=FRANCHISE_MEDIA_ALIASES[candidate.animeId]?candidate.title:(getDisplayTitle(item?.title,candidate.title));
      return <a className="anime-detail-franchise-card" href={(lang==="en"?"/en":"") + "/anime/"+candidate.animeId} key={candidate.animeId}>
       <div className="anime-detail-franchise-poster">{image?<img src={image} alt=""/>:<div/>}</div>
       <div className="anime-detail-franchise-copy"><strong>{candidateTitle}</strong><span>{candidate.format==="MOVIE"||item?.format==="MOVIE"?(lang==="en"?"Film":"Película"):(lang==="en"?"Series":"Serie")} · {candidate.state.status==="WATCHED"?(lang==="en"?"Watched":"Vista"):(lang==="en"?"Pending":"Pendiente")}</span></div>
      </a>;
    })}
   </div>
  </section>}
  {relations.length>0&&<section className="anime-detail-related">
   <div className="anime-detail-related-header"><span className="anime-detail-label">{t("detail.universe")}</span><h2>{t("detail.related")}</h2></div>
   <div className="anime-detail-related-grid">
    {relations.slice(0,12).map((relation,index)=>{
      const node=relation.node;
      if(!node) return null;
      const label=relation.relationType==="SEQUEL"?t("detail.sequel"):relation.relationType==="PREQUEL"?t("detail.prequel"):relation.relationType==="SIDE_STORY"?t("detail.sideStory"):relation.relationType==="SPIN_OFF"?t("detail.spinOff"):relation.relationType==="ALTERNATIVE"?t("detail.alternative"):relation.relationType==="PARENT"?t("detail.main"):relation.relationType==="ADAPTATION"?t("detail.adaptation"):t("detail.relatedLabel");
      return <a className="anime-detail-related-card" href={(lang==="en"?"/en":"") + "/anime/" + node.id} key={node.id+"-"+index}>
        <div className="anime-detail-related-poster">{node.coverImage?.extraLarge||node.coverImage?.large?<img src={node.coverImage.extraLarge||node.coverImage.large||""} alt=""/>:<div/>}</div>
        <div className="anime-detail-related-copy"><strong>{getDisplayTitle(node.title)||t("detail.noTitle")}</strong><span>{label} · {node.format==="MOVIE"?t("detail.film"):node.format==="OVA"?"OVA":node.format==="SPECIAL"?t("detail.special"):t("detail.series")}</span></div>
      </a>;
    })}
   </div>
  </section>} </div>;
}
