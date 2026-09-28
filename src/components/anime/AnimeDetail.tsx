import { useEffect, useState } from "react";
import type { LibraryEntry } from "../../types/personal";

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
  relations?: { edges?: { relationType?: string|null; node?: { id:number; type?:string|null; format?:string|null; title?: { romaji?:string|null; english?:string|null }; coverImage?: { extraLarge?:string|null; large?:string|null } } }[] }|null;
}

const ENDPOINT="https://graphql.anilist.co";
const CACHE_PREFIX="renanime:detail:v1:";
const TRANSLATION_PREFIX="renanime:translation:en-es:v1:";

function cleanDescription(text:string){
  return text
    .replace(/<br\s*\/?>/gi, "\n")
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

async function findAnime(entry: LibraryEntry): Promise<Media|null> {
  try {
    const cached=sessionStorage.getItem(CACHE_PREFIX+entry.animeId);
    if(cached) return JSON.parse(cached);
  } catch {}
  const query=`query Detail($search:String!){Page(page:1,perPage:1){media(search:$search,type:ANIME,sort:SEARCH_MATCH){id title{romaji english} description(asHtml:false) genres startDate{year month day} format status episodes duration studios(isMain:true){nodes{name}} coverImage{extraLarge large} bannerImage trailer{id site thumbnail} relations{edges{relationType node{id type format title{romaji english} coverImage{extraLarge large}}}}}}}`;
  try {
    const response=await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query,variables:{search:entry.title}})});
    if(!response.ok) return null;
    const payload=await response.json();
    const media=payload.data?.Page?.media?.[0]??null;
    try{sessionStorage.setItem(CACHE_PREFIX+entry.animeId,JSON.stringify(media));}catch{}
    return media;
  } catch { return null; }
}

function date(value:Media["startDate"]){
  if(!value?.year) return "Fecha desconocida";
  if(!value.month||!value.day) return String(value.year);
  return new Date(value.year,value.month-1,value.day).toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"});
}

function format(value:string|null|undefined){return value==="MOVIE"?"Film":value==="TV"?"Series":value||"Anime";}
function status(value:string|null|undefined){return value==="FINISHED"?"Finalizado":value==="RELEASING"?"En emisión":value==="NOT_YET_RELEASED"?"Próximamente":value==="HIATUS"?"En pausa":value==="CANCELLED"?"Cancelado":"";}

export default function AnimeDetail({entry}:{entry:LibraryEntry}){
 const[media,setMedia]=useState<Media|null>(null),[loading,setLoading]=useState(true),[translatedSynopsis,setTranslatedSynopsis]=useState(""),[translating,setTranslating]=useState(false);
 const cleanSynopsis=media?.description?cleanDescription(media.description):"";
 useEffect(()=>{let cancelled=false;findAnime(entry).then(value=>{if(!cancelled)setMedia(value)}).finally(()=>{if(!cancelled)setLoading(false)});return()=>{cancelled=true}},[entry.animeId]);
 const translateSynopsis=async()=>{if(!media?.description||translating)return;setTranslating(true);const value=await translateToSpanish(media.description);setTranslatedSynopsis(value);setTranslating(false)};
 const title=media?.title?.romaji||media?.title?.english||entry.title;
 const poster=media?.coverImage?.extraLarge||media?.coverImage?.large;
 const banner=media?.bannerImage||poster;
 const personal=entry.state;
 const relations=(media?.relations?.edges??[]).filter(edge=>edge.node?.type==="ANIME"&&edge.node.id!==media?.id);
 return <div className="anime-detail">
  <section className="anime-detail-hero" style={banner?{backgroundImage:`linear-gradient(90deg,rgba(9,9,9,.98) 0%,rgba(9,9,9,.78) 43%,rgba(9,9,9,.35) 72%,rgba(9,9,9,.72) 100%),linear-gradient(0deg,rgba(9,9,9,.98),transparent 42%),url("${banner}")`}:undefined}>
   <div className="anime-detail-inner">
    <a className="anime-detail-back" href="/collection/">← Volver a la colección</a>
    <div className="anime-detail-layout">
      <div className="anime-detail-poster">{poster?<img src={poster} alt={title}/>:<div className="anime-detail-placeholder">RENANIME</div>}</div>
      <div className="anime-detail-copy">
       {personal.favorite&&<span className="anime-detail-eyebrow">Favorito</span>}
       <h1>{title}</h1>
       <div className="anime-detail-meta"><span>{format(entry.format||media?.format)}</span><span>{date(media?.startDate)}</span>{media?.episodes&&<span>{media.episodes} episodios</span>}{media?.duration&&<span>{media.duration} min</span>}</div>
       {media?.genres?.length&&<div className="anime-detail-genres">{media.genres.slice(0,5).map(g=><span>{g}</span>)}</div>}
       <div className="anime-detail-synopsis-wrap">
        <p className="anime-detail-synopsis">{loading?"Cargando ficha…":translatedSynopsis||cleanSynopsis||"Todavía no hay una sinopsis disponible para este título."}</p>
        {media?.description&&<button type="button" className="anime-detail-translate" onClick={translateSynopsis} disabled={translating}>{translating?"Traduciendo…":translatedSynopsis?"Traducido al español":"Traducir al español"}</button>}
       </div>
       {media?.trailer?.id&&media.trailer.site==="youtube"&&<section className="anime-detail-trailer">
        <span className="anime-detail-label">Tráiler</span>
        <div className="anime-detail-video"><iframe src={"https://www.youtube.com/embed/"+media.trailer.id+"?rel=0"} title={"Tráiler de "+title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>
       </section>}
       <div className="anime-detail-state">
        <span>{personal.status==="WATCHED"?"Visto":personal.status==="PENDING"?"Pendiente":"En mi archivo"}</span>
        {personal.recommended&&<span>Recomendado por Ren</span>}
        {status(media?.status)&&<span>{status(media?.status)}</span>}
       </div>
      </div>
    </div>
   </div>
  </section>
  <section className="anime-detail-info">
   <div><span className="anime-detail-label">Información</span><strong>{media?.studios?.nodes?.map(s=>s.name).join(" · ")||"Estudio no disponible"}</strong></div>
   <div><span className="anime-detail-label">Mi estado</span><strong>{personal.status==="WATCHED"?"He visto este anime":personal.status==="PENDING"?"Quiero verlo":"Parte de mi archivo"}</strong></div>
  </section>
  {relations.length>0&&<section className="anime-detail-related">
   <div className="anime-detail-related-header"><span className="anime-detail-label">Universo</span><h2>Relacionado</h2></div>
   <div className="anime-detail-related-grid">
    {relations.slice(0,8).map(({relationType,node})=><a className="anime-detail-related-card" href={"/anime/search/?id="+node!.id} key={node!.id}>
      <div className="anime-detail-related-poster">{node!.coverImage?.extraLarge||node!.coverImage?.large?<img src={node!.coverImage.extraLarge||node!.coverImage.large||""} alt=""/>:<div/>}</div>
      <div className="anime-detail-related-copy"><strong>{node!.title?.romaji||node!.title?.english||"Sin título"}</strong><span>{relationType==="SEQUEL"?"Secuela":relationType==="PREQUEL"?"Precuela":relationType==="SIDE_STORY"?"Historia paralela":relationType==="SPIN_OFF"?"Spin-off":relationType==="ALTERNATIVE"?"Alternativa":"Relacionado"} · {node!.format==="MOVIE"?"Film":"Series"}</span></div>
    </a>)}
   </div>
  </section>
 </div>;
}
