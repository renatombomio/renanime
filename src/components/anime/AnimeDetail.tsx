import { useEffect, useState } from "react";
import type { LibraryEntry } from "../../types/personal";
import { getLibrary } from "../../data/library";
import { getPersonalFranchiseEntries } from "../../data/franchise";
import PersonalLibraryActions from "../personal-library/PersonalLibraryActions";

interface Media {
  id: number;
  title?: { romaji?: string|null; english?: string|null };
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
  recommendations?: { nodes?: { mediaRecommendation?: { id:number; title?: { romaji?:string|null; english?:string|null }; coverImage?: { extraLarge?:string|null; large?:string|null }; format?:string|null; startDate?: { year?:number|null }|null }|null }[] }|null;
  relations?: { edges?: { relationType?: string|null; node?: { id:number; type?:string|null; format?:string|null; title?: { romaji?:string|null; english?:string|null }; coverImage?: { extraLarge?:string|null; large?:string|null } } }[] }|null;
}

const ENDPOINT="https://graphql.anilist.co";
const CACHE_PREFIX="renanime:detail:v6:";
const TRANSLATION_PREFIX="renanime:translation:en-es:v1:";

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





async function fetchAniListRecommendations(mediaId:number){
  const query=`query Recommendations($mediaId:Int!){
    Media(id:$mediaId,type:ANIME){
      recommendations(sort:RATING_DESC,page:1,perPage:12){
        nodes{
          mediaRecommendation{
            id
            title{romaji english}
            coverImage{extraLarge large}
            format
            startDate{year}
          }
        }
      }
    }
  }`;
  try{
    const response=await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query,variables:{mediaId}})});
    if(!response.ok)return [];
    const payload=await response.json();
    return (payload.data?.Media?.recommendations?.nodes??[])
      .map((node:any)=>node.mediaRecommendation)
      .filter(Boolean)
      .filter((item:any)=>item.id!==mediaId)
      .slice(0,8);
  }catch{return []}
}

async function findAnime(entry: LibraryEntry): Promise<Media|null> {
  try {
    const cached=sessionStorage.getItem(CACHE_PREFIX+entry.animeId);
    if(cached) return JSON.parse(cached);
  } catch {}
  const query=`query Detail($search:String!){Page(page:1,perPage:1){media(search:$search,type:ANIME,sort:SEARCH_MATCH){id title{romaji english} description(asHtml:false) genres startDate{year month day} format status episodes duration studios(isMain:true){nodes{name}} coverImage{extraLarge large} bannerImage trailer{id site thumbnail} recommendations(sort:RATING_DESC,page:1,perPage:12){nodes{mediaRecommendation{id title{romaji english} coverImage{extraLarge large} format startDate{year}}}} relations{edges{relationType node{id type format title{romaji english} coverImage{extraLarge large}}}}}}}`;
  try {
    const response=await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query,variables:{search:entry.title}})});
    if(!response.ok) return null;
    const payload=await response.json();
    const media=payload.data?.Page?.media?.[0]??null;
    if(!media)return null;
    const related=await fetchAniListRecommendations(media.id);
    media.recommendations={nodes:related.map((item:any)=>({mediaRecommendation:item}))};
    try{sessionStorage.setItem(CACHE_PREFIX+entry.animeId,JSON.stringify(media));}catch{}
    return media;
  } catch { return null; }
}

async function findAnimeBatch(entries: LibraryEntry[]): Promise<Record<string, Media|null>> {
  const result: Record<string, Media|null> = {};
  const unresolved: LibraryEntry[] = [];

  for (const entry of entries) {
    try {
      const cached = sessionStorage.getItem(CACHE_PREFIX + entry.animeId);
      if (cached) {
        const parsed = JSON.parse(cached) as Media|null;
        if (parsed) {
          result[entry.animeId] = parsed;
          continue;
        }
        sessionStorage.removeItem(CACHE_PREFIX + entry.animeId);
      }
    } catch {}
    unresolved.push(entry);
  }

  if (!unresolved.length) return result;

  // AniList can reject very large aliased Page queries with HTTP 400.
  // Resolve franchise entries in small batches so one large franchise
  // cannot make every poster disappear.
  const BATCH_SIZE = 5;

  for (let offset = 0; offset < unresolved.length; offset += BATCH_SIZE) {
    const batch = unresolved.slice(offset, offset + BATCH_SIZE);
    const variables: Record<string, string> = {};

    const fields = batch.map((entry, index) => {
      const key = "s" + index;
      const alias = "a" + index;
      variables[key] = entry.title;

      return `${alias}: Page(page:1,perPage:1){media(search:$${key},type:ANIME,sort:SEARCH_MATCH){id title{romaji english} description(asHtml:false) genres startDate{year month day} format status episodes duration studios(isMain:true){nodes{name}} coverImage{extraLarge large} bannerImage trailer{id site thumbnail}}}`;
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

      batch.forEach((entry, index) => {
        const media = payload.data?.["a" + index]?.media?.[0] ?? null;
        result[entry.animeId] = media;

        // Never persist a failed lookup as null: a temporary API failure
        // must not permanently hide a franchise poster for this session.
        if (media) {
          try {
            sessionStorage.setItem(CACHE_PREFIX + entry.animeId, JSON.stringify(media));
          } catch {}
        }
      });
    } catch {}
  }

  return result;
}

function date(value:Media["startDate"]){
  if(!value?.year) return "Fecha desconocida";
  if(!value.month||!value.day) return String(value.year);
  return new Date(value.year,value.month-1,value.day).toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"});
}

function format(value:string|null|undefined){return value==="MOVIE"?"Película":value==="TV"?"Serie":value||"Anime";}
function status(value:string|null|undefined){return value==="FINISHED"?"Finalizado":value==="RELEASING"?"En emisión":value==="NOT_YET_RELEASED"?"Próximamente":value==="HIATUS"?"En pausa":value==="CANCELLED"?"Cancelado":"";}

export default function AnimeDetail({entry}:{entry:LibraryEntry}){
 const[media,setMedia]=useState<Media|null>(null),[loading,setLoading]=useState(true),[translatedSynopsis,setTranslatedSynopsis]=useState(""),[translating,setTranslating]=useState(false),[franchiseMedia,setFranchiseMedia]=useState<Record<string,Media|null>>({});
 const cleanSynopsis=media?.description?cleanDescription(media.description):"";
 const hasSynopsis=cleanSynopsis.replace(/[\s\\n\\r]+/g,"").length>0;
 const franchiseEntries=getPersonalFranchiseEntries(entry,getLibrary());
 useEffect(()=>{
  let cancelled=false;
  findAnime(entry).then(value=>{if(!cancelled)setMedia(value)}).finally(()=>{if(!cancelled)setLoading(false)});
  if(franchiseEntries.length>1){
   findAnimeBatch(franchiseEntries).then(results=>{
    if(cancelled)return;
    setFranchiseMedia(results);
   });
  }
  return()=>{cancelled=true};
 },[entry.animeId]);
 const translateSynopsis=async()=>{if(!media?.description||translating)return;setTranslating(true);const value=await translateToSpanish(media.description);setTranslatedSynopsis(value);setTranslating(false)};
 const title=media?.title?.romaji||media?.title?.english||entry.title;
 const poster=media?.coverImage?.extraLarge||media?.coverImage?.large;
 const banner=media?.bannerImage||poster;
 const personal=entry.state;
 const relations=(media?.relations?.edges??[]).filter(edge=>edge.node?.type==="ANIME"&&edge.node.id!==media?.id);
 return <div className="anime-detail">
  <style>{`
    .anime-detail:not(.anime-detail--ghibli) .anime-detail-synopsis-wrap{max-width:42rem;margin-top:1.35rem;padding:1rem 1.15rem 1.1rem;border:1px solid rgba(245,242,236,.18);border-radius:14px;background:rgba(9,9,9,.42);box-shadow:0 12px 34px rgba(0,0,0,.16);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
    .anime-detail:not(.anime-detail--ghibli) .anime-detail-synopsis{margin:0;color:var(--color-paper-50)}
    .anime-detail:not(.anime-detail--ghibli) .anime-detail-translate{border-color:rgba(245,242,236,.28);background:rgba(245,242,236,.06);color:var(--color-paper-200)}
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
    <a className="anime-detail-back" href="/collection/">← Volver a la colección</a>
    <div className="anime-detail-layout">
      <div className="anime-detail-poster">{poster?<img src={poster} alt={title}/>:<div className="anime-detail-placeholder">RENANIME</div>}</div>
      <div className="anime-detail-copy">
       <div className="anime-detail-copy-main">
       {personal.favorite&&<span className="anime-detail-eyebrow">Favorito</span>}
       <h1>{title}</h1>
       <div className="anime-detail-meta">
  <span className="anime-detail-meta-type"><strong>{format(entry.format||media?.format)}</strong></span>
  <span><small>LANZAMIENTO</small><strong>{date(media?.startDate)}</strong></span>
  {media?.format!=="MOVIE"&&media?.episodes&&<span><small>EPISODIOS</small><strong>{media.episodes}</strong></span>}
  {media?.duration&&<span><small>{media?.format==="MOVIE"?"DURACIÓN":"DURACIÓN / EPISODIO"}</small><strong>{media.duration} min</strong></span>}
</div>
       {media?.id && <div className="anime-detail-library-actions"><PersonalLibraryActions animeId={media.id} /></div>}
       {media?.genres?.length&&<div className="anime-detail-genres">{media.genres.slice(0,5).map((genre)=><span key={genre}>{genre}</span>)}</div>}




       </div>
      </div>
       <div className="anime-detail-synopsis-wrap">
        <p className="anime-detail-synopsis">{loading?"Cargando ficha…":translatedSynopsis||cleanSynopsis||"Todavía no hay una sinopsis disponible para este título."}</p>
        {hasSynopsis&&media?.description&&<button type="button" className="anime-detail-translate" onClick={translateSynopsis} disabled={translating}>{translating?"Traduciendo…":translatedSynopsis?"Traducido al español":"Traducir al español"}</button>}
       </div>
       {media?.trailer?.id&&media.trailer.site==="youtube"&&<section className="anime-detail-trailer">
        <span className="anime-detail-label">Tráiler</span>
        <div className="anime-detail-video"><iframe src={"https://www.youtube.com/embed/"+media.trailer.id+"?rel=0"} title={"Tráiler de "+title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>
       </section>}
       {(() => {
        const seen = new Set<number>();
        const items = (media?.recommendations?.nodes ?? [])
          .map((node) => node.mediaRecommendation)
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .filter((item) => item.id !== media?.id && !seen.has(item.id) && seen.add(item.id))
          .slice(0, 8);
        return <section className="anime-detail-recommendations" aria-label="Recomendaciones">
          <div className="anime-detail-recommendations-head">
            <span className="anime-detail-label">Si te gusta este anime, te puede gustar…</span>
          </div>
          <div className="anime-detail-recommendations-track">
            {items.length ? items.map((item) => {
              const recTitle=item.title?.romaji||item.title?.english||"Sin título";
              const recImage=item.coverImage?.extraLarge||item.coverImage?.large;
              return <a className="anime-detail-recommendation" href={"/anime/search?id="+item.id+"&from=anime&back=/anime/"+entry.animeId} key={item.id}>
                <div className="anime-detail-recommendation-poster">{recImage&&<img src={recImage} alt={recTitle} loading="lazy" />}</div>
                <span className="anime-detail-recommendation-title">{recTitle}</span>
                <span className="anime-detail-recommendation-meta">{item.format==="MOVIE"?"Film":"Series"}{item.startDate?.year?" · "+item.startDate.year:""}</span>
              </a>;
            }) : null}
          </div>
        </section>;
       })()}
       <div className="anime-detail-state">
        <span>{personal.status==="WATCHED"?"Visto":personal.status==="PENDING"?"Pendiente":"En mi archivo"}</span>
        {personal.recommended&&<span>Recomendado por Ren</span>}
        {status(media?.status)&&<span>{status(media?.status)}</span>}
       </div>
    </div>
   </div>
  </section>
  <section className="anime-detail-info">
   <div><span className="anime-detail-label">Información</span><strong>{media?.studios?.nodes?.map(s=>s.name).join(" · ")||"Estudio no disponible"}</strong></div>
   <div><span className="anime-detail-label">Mi estado</span><strong>{personal.status==="WATCHED"?"He visto este anime":personal.status==="PENDING"?"Quiero verlo":"Parte de mi archivo"}</strong></div>
  </section>
  {franchiseEntries.length>1&&<section className="anime-detail-franchise">
   <div className="anime-detail-related-header"><span className="anime-detail-label">Mi colección</span><h2>Esta franquicia</h2></div>
   <div className="anime-detail-franchise-grid">
    {franchiseEntries.map((candidate,index)=>{
      const item=franchiseMedia[candidate.animeId];
      const image=item?.coverImage?.extraLarge||item?.coverImage?.large;
      const candidateTitle=item?.title?.romaji||item?.title?.english||candidate.title;
      return <a className={"anime-detail-franchise-card"+(candidate.animeId===entry.animeId?" is-current":"")} href={"/anime/"+candidate.animeId} key={candidate.animeId}>
       <div className="anime-detail-franchise-poster">{image?<img src={image} alt=""/>:<div/>}{candidate.animeId===entry.animeId&&<span>Estás aquí</span>}</div>
       <div className="anime-detail-franchise-copy"><strong>{candidateTitle}</strong><span>{candidate.format==="MOVIE"||item?.format==="MOVIE"?"Film":"Series"} · {candidate.state.status==="WATCHED"?"Vista":"Pendiente"}</span></div>
      </a>;
    })}
   </div>
  </section>}
  {relations.length>0&&<section className="anime-detail-related">
   <div className="anime-detail-related-header"><span className="anime-detail-label">Universo</span><h2>Relacionado</h2></div>
   <div className="anime-detail-related-grid">
    {relations.slice(0,8).map((relation,index)=>{
      const node=relation.node;
      if(!node) return null;
      const label=relation.relationType==="SEQUEL"?"Secuela":relation.relationType==="PREQUEL"?"Precuela":relation.relationType==="SIDE_STORY"?"Historia paralela":relation.relationType==="SPIN_OFF"?"Spin-off":relation.relationType==="ALTERNATIVE"?"Alternativa":"Relacionado";
      return <a className="anime-detail-related-card" href={"/anime/search?id="+node.id+"&from=anime&back=/anime/"+entry.animeId} key={node.id+"-"+index}>
        <div className="anime-detail-related-poster">{node.coverImage?.extraLarge||node.coverImage?.large?<img src={node.coverImage.extraLarge||node.coverImage.large||""} alt=""/>:<div/>}</div>
        <div className="anime-detail-related-copy"><strong>{node.title?.romaji||node.title?.english||"Sin título"}</strong><span>{label} · {node.format==="MOVIE"?"Film":"Series"}</span></div>
      </a>;
    })}
   </div>
  </section>} </div>;
}
