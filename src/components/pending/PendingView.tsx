import { useEffect, useState } from "react";
import type { LibraryEntry } from "../../types/personal";

interface Media { title?: { romaji?: string|null; english?: string|null }; startDate?: {year?:number|null;month?:number|null;day?:number|null}|null; coverImage?: {extraLarge?:string|null;large?:string|null}; format?: string|null; }
interface Props { entries: LibraryEntry[]; }
const CACHE_PREFIX="renanime:pending:v1:";

async function fetchMedia(entries: LibraryEntry[]) {
  const result: Record<string, Media|null> = {};
  const unresolved: LibraryEntry[] = [];
  for (const entry of entries) {
    try {
      const cached=sessionStorage.getItem(CACHE_PREFIX+entry.title.toLowerCase());
      if(cached){ result[entry.animeId]=JSON.parse(cached); continue; }
    } catch {}
    unresolved.push(entry);
  }
  for(let start=0;start<unresolved.length;start+=20){
    const batch=unresolved.slice(start,start+20);
    const variables: Record<string,string>={};
    const fields=batch.map((entry,index)=>{
      variables["s"+index]=entry.title;
      return "a"+index+': Page(page: 1, perPage: 1) { media(search: $s'+index+', type: ANIME, sort: SEARCH_MATCH) { title { romaji english } startDate { year month day } coverImage { extraLarge large } format } }';
    }).join("\n");
    const definitions=batch.map((_,index)=>"$s"+index+": String!").join(", ");
    try{
      const response=await fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query:"query Pending("+definitions+") { "+fields+" }",variables})});
      if(!response.ok) continue;
      const payload=await response.json();
      batch.forEach((entry,index)=>{
        const media=payload.data?.["a"+index]?.media?.[0]??null;
        result[entry.animeId]=media;
        try{sessionStorage.setItem(CACHE_PREFIX+entry.title.toLowerCase(),JSON.stringify(media));}catch{}
      });
    }catch{}
  }
  return result;
}
function formatDate(date:Media["startDate"]){
  if(!date?.year)return "Fecha desconocida";
  if(!date.month||!date.day)return String(date.year);
  return new Date(date.year,date.month-1,date.day).toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"});
}
export default function PendingView({entries}:Props){
  const [media,setMedia]=useState<Record<string,Media|null>>({});
  const [loading,setLoading]=useState(true);
  useEffect(()=>{let cancelled=false;fetchMedia(entries).then(result=>{if(!cancelled){setMedia(result);setLoading(false);}});return()=>{cancelled=true;};},[entries]);
  return <div className="pending-view">
    <div className="pending-meta"><span>{entries.length} títulos esperando</span></div>
    {loading?<div className="pending-loading">Cargando archivo…</div>:entries.length===0?<div className="pending-empty">No hay títulos pendientes.</div>:
      <div className="pending-grid">{entries.map((entry,index)=>{
        const item=media[entry.animeId], image=item?.coverImage?.extraLarge??item?.coverImage?.large, title=item?.title?.romaji||item?.title?.english||entry.title;
        const format=entry.format==="MOVIE"||item?.format==="MOVIE"?"Film":"Series";
        return <article className="pending-card" key={entry.animeId}><a href={"/anime/"+entry.animeId} aria-label={"Ver "+title}>
          <div className="pending-poster">{image?<img src={image} alt="" loading={index<6?"eager":"lazy"}/>:<div className="pending-placeholder"><span>{String(index+1).padStart(2,"0")}</span><strong>{entry.title}</strong></div>}</div>
          <div className="pending-info"><h3>{title}</h3><span>{formatDate(item?.startDate)} · {format}</span></div>
        </a></article>;
      })}</div>}
  </div>;
}
