import { useEffect, useState } from "react";
import type { PersonalAnimeEntry } from "../../types/personal";
import { getPersonalLibrary, subscribeToPersonalLibrary } from "../../data/personal-library";
import PersonalLibraryActions from "./PersonalLibraryActions";

type Mode = "WATCHED" | "PENDING";
interface Props { mode: Mode; }
interface Media {
  id:number;
  title?:{romaji?:string|null;english?:string|null};
  startDate?:{year?:number|null;month?:number|null;day?:number|null}|null;
  format?:string|null;
  coverImage?:{extraLarge?:string|null;large?:string|null};
}

async function fetchMedia(ids:string[]):Promise<Record<string,Media|null>>{
  const result:Record<string,Media|null>={};
  const valid=ids.map(Number).filter(Number.isFinite);
  if(!valid.length)return result;
  const variables:Record<string,number>={};
  const fields=valid.map((id,i)=>{
    const key="id"+i; variables[key]=id;
    return `a${i}: Media(id: $${key}, type: ANIME) { id title { romaji english } startDate { year month day } format coverImage { extraLarge large } }`;
  }).join("\n");
  const definitions=valid.map((_,i)=>`$id${i}: Int!`).join(", ");
  try{
    const response=await fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query:`query PersonalLibrary(${definitions}) { ${fields} }`,variables})});
    if(!response.ok)return result;
    const payload=await response.json();
    valid.forEach((id,i)=>{result[String(id)]=payload.data?.["a"+i]??null;});
  }catch{}
  return result;
}

function formatDate(date:Media["startDate"]){
  if(!date?.year)return "Fecha desconocida";
  if(!date.month||!date.day)return String(date.year);
  return new Date(date.year,date.month-1,date.day).toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"});
}

export default function PersonalLibraryView({mode}:Props){
  const [entries,setEntries]=useState<PersonalAnimeEntry[]>([]);
  const [media,setMedia]=useState<Record<string,Media|null>>({});
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const sync=()=>setEntries(getPersonalLibrary().filter(entry=>entry.state.status===mode));
    sync();
    return subscribeToPersonalLibrary(sync);
  },[mode]);

  useEffect(()=>{
    let cancelled=false;
    const missing=entries.map(entry=>entry.animeId).filter(id=>!(id in media));
    if(!missing.length){setLoading(false);return;}
    setLoading(true);
    fetchMedia(missing).then(result=>{if(!cancelled)setMedia(current=>({...current,...result}));}).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[entries.map(entry=>entry.animeId).join("|")]);

  if(loading&&!entries.length)return <p className="personal-library-status">Cargando mi biblioteca…</p>;

  return <div className="personal-library-view">
    <div className="personal-library-count">{entries.length} {entries.length===1?"anime":"animes"}</div>
    {entries.length?<div className="personal-library-grid">
      {entries.map(entry=>{
        const item=media[entry.animeId];
        const title=item?.title?.romaji||item?.title?.english||"Anime";
        const image=item?.coverImage?.extraLarge||item?.coverImage?.large;
        return <article className="personal-library-card" key={entry.animeId}>
          <a href={`/anime/search?id=${entry.animeId}&from=personal-library`} className="personal-library-link">
            <div className="personal-library-poster">{image?<img src={image} alt="" loading="lazy"/>:<div className="personal-library-placeholder"/>}</div>
            <div className="personal-library-info"><h2>{title}</h2><span>{formatDate(item?.startDate)} · {item?.format==="MOVIE"?"Film":"Series"}</span></div>
          </a>
          <PersonalLibraryActions animeId={Number(entry.animeId)}/>
        </article>;
      })}
    </div>:<div className="personal-library-empty">
      <strong>{mode==="WATCHED"?"Tu colección está vacía.":"Tu lista está vacía."}</strong>
      <span>{mode==="WATCHED"?"Cuando marques un anime como visto, aparecerá aquí.":"Añade animes desde Buscar y aparecerán aquí."}</span>
    </div>}
    <style>{`
      .personal-library-view{width:100%}.personal-library-count{margin-bottom:1.5rem;color:var(--color-muted-400);font-family:var(--font-meta);font-size:.62rem;letter-spacing:.08em;text-transform:uppercase}
      .personal-library-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:clamp(3rem,5vw,5rem) clamp(.85rem,1.8vw,1.75rem)}.personal-library-card{min-width:0}
      .personal-library-link{display:block;color:inherit}.personal-library-poster{aspect-ratio:2/3;overflow:hidden;background:var(--color-ink-800)}.personal-library-poster img{display:block;width:100%;height:100%;object-fit:cover;transition:transform 650ms cubic-bezier(.2,.7,.2,1)}.personal-library-link:hover .personal-library-poster img{transform:scale(1.035)}
      .personal-library-placeholder{width:100%;height:100%;background:linear-gradient(145deg,var(--color-ink-700),var(--color-ink-950))}.personal-library-info{display:grid;gap:.35rem;padding-top:.7rem}.personal-library-info h2{margin:0;color:var(--color-paper-50);font-family:var(--font-body);font-size:.82rem;font-weight:500;line-height:1.2}.personal-library-info span{color:var(--color-muted-400);font-family:var(--font-meta);font-size:.52rem;letter-spacing:.04em;text-transform:uppercase}
      .personal-library-status,.personal-library-empty{padding:4rem 1rem;border:1px solid var(--color-border);color:var(--color-muted-400);text-align:center}.personal-library-empty{display:grid;gap:.6rem}.personal-library-empty strong{color:var(--color-paper-50);font-family:var(--font-body);font-size:1.1rem;font-weight:500}
      @media(max-width:1100px){.personal-library-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:800px){.personal-library-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:560px){.personal-library-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:2.25rem .65rem}.personal-library-info h2{font-size:.72rem}.personal-library-info span{font-size:.46rem}}
    `}</style>
  </div>;
}