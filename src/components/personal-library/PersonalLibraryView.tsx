import { useEffect, useState } from "react";
import type { PersonalAnimeEntry } from "../../types/personal";
import { getPersonalLibrary, subscribeToPersonalLibrary } from "../../data/personal-library";

type Mode = "WATCHED" | "PENDING";
interface Props { mode: Mode; }
interface Media {
  id:number;
  title?:{romaji?:string|null;english?:string|null};
  startDate?:{year?:number|null;month?:number|null;day?:number|null}|null;
  format?:string|null;
  coverImage?:{extraLarge?:string|null;large?:string|null};
}

const PAGE_SIZE = 15;

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
function titleOf(media?:Media|null){return media?.title?.romaji||media?.title?.english||"Anime";}
function isMovie(media?:Media|null){return media?.format === "MOVIE";}

export default function PersonalLibraryView({mode}:Props){
  const [entries,setEntries]=useState<PersonalAnimeEntry[]>([]);
  const [media,setMedia]=useState<Record<string,Media|null>>({});
  const [loading,setLoading]=useState(true);
  const [visible,setVisible]=useState(PAGE_SIZE);

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

  const visibleEntries=entries.slice(0,visible);
  const hasMore=visible<entries.length;

  if(loading&&!entries.length)return <p className="personal-library-status">Cargando mi biblioteca…</p>;

  return <div className="personal-library-view">
    <div className="personal-library-intro"><span>{mode==="WATCHED"?"Tu recorrido":"Guardado para después"}</span><div className="personal-library-count" aria-live="polite">
      {entries.length} {entries.length===1?"anime":"animes"}
    </div></div>

    {visibleEntries.length?<div className="personal-library-grid">
      {visibleEntries.map(entry=>{
        const item=media[entry.animeId];
        const title=titleOf(item);
        const image=item?.coverImage?.extraLarge||item?.coverImage?.large;
        const score=entry.state.personalScore;
        return <article className="personal-library-card" key={entry.animeId}>
          <a href={`/anime/search?id=${entry.animeId}&from=personal-library`} className="personal-library-link" aria-label={`Ver ${title}`}>
            <div className="personal-library-poster">
              {image?<img src={image} alt="" loading="lazy"/>:<div className="personal-library-placeholder" aria-hidden="true"/>}
              <div className="personal-library-overlay">
                <h2>{title}</h2>
                <span>{item?.startDate?.year||"—"}</span>
              </div>
              <div className="personal-library-badges" aria-hidden="true">
                {entry.state.favorite&&<span>Favorito</span>}
                {entry.state.recommended&&<span>Recomendado</span>}
                {score!=null&&<span>★ {score}</span>}
              </div>
            </div>
          </a>
        </article>;
      })}
    </div>:<div className="personal-library-empty">
      <strong>{mode==="WATCHED"?"¿Qué, todavía no has visto anime?":"Esto está igual de vacío que tu corazón."}</strong>
      <span>{mode==="WATCHED"?"¿No sabes lo que te estás perdiendo? Venga, anímate, que me hace falta más gente friki por aquí. 😂":"Venga va, dame cariño y mete algún anime en la lista. Gracias. No leo lloros. 🫶"}</span>
      <a className="personal-library-empty-cta" href="/search/">{mode==="WATCHED"?"Explorar anime →":"Buscar algo que ver →"}</a>
    </div>}

    {hasMore&&<button type="button" className="personal-library-load-more" onClick={()=>setVisible(value=>Math.min(value+PAGE_SIZE,entries.length))}>Cargar más · {entries.length-visible} restantes</button>}

    <style>{`
      .personal-library-view{width:100%}
      .personal-library-intro{display:flex;align-items:baseline;justify-content:space-between;gap:1rem;padding-bottom:.85rem;border-bottom:1px solid var(--color-border);color:var(--color-accent-soft);font:500 .58rem/1 var(--font-meta);letter-spacing:.11em;text-transform:uppercase}
      .personal-library-count{margin:0;color:var(--color-muted-400);}
      
      .personal-library-grid{display:grid;margin-top:clamp(2rem,4vw,3.5rem);grid-template-columns:repeat(5,minmax(0,1fr));gap:clamp(3rem,5vw,5rem) clamp(.85rem,1.8vw,1.75rem)}
      .personal-library-card{min-width:0}
      .personal-library-link{display:block;color:inherit;transition:transform 280ms var(--ease-out)}
      .personal-library-link:hover{transform:translateY(-3px)}
      .personal-library-poster{position:relative;aspect-ratio:2/3;overflow:hidden;background:var(--color-ink-800)}
      .personal-library-poster img{display:block;width:100%;height:100%;object-fit:cover;transition:transform var(--duration-slow) var(--ease-out),filter var(--duration-base) var(--ease-out)}
      .personal-library-link:hover .personal-library-poster img{transform:scale(1.035);filter:saturate(1.04)}
      .personal-library-poster::after{position:absolute;inset:0;background:linear-gradient(180deg,rgba(9,9,9,.02) 38%,rgba(9,9,9,.88) 100%);content:"";pointer-events:none}
      .personal-library-placeholder{width:100%;height:100%;background:radial-gradient(circle at 18% 18%,rgba(245,242,236,.08),transparent 38%),linear-gradient(145deg,var(--color-ink-700),var(--color-ink-950))}
      .personal-library-overlay{position:absolute;right:.7rem;bottom:.7rem;left:.7rem;z-index:2;color:var(--color-paper-50)}
      .personal-library-overlay h2{display:-webkit-box;overflow:hidden;margin:0;font:500 .82rem/1.12 var(--font-body);-webkit-box-orient:vertical;-webkit-line-clamp:2}
      .personal-library-overlay span{display:block;margin-top:.32rem;color:var(--color-paper-200);font:600 .62rem/1 var(--font-meta);letter-spacing:.09em}
      .personal-library-badges{position:absolute;top:.6rem;right:.6rem;left:.6rem;z-index:2;display:flex;flex-wrap:wrap;gap:.35rem}
      .personal-library-badges span{padding:.3rem .4rem;border:1px solid rgba(245,242,236,.22);background:rgba(9,9,9,.55);backdrop-filter:blur(8px);color:var(--color-paper-50);font:500 .48rem/1 var(--font-meta);letter-spacing:.06em;text-transform:uppercase}
      @media(max-width:900px){.personal-library-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:2.5rem .75rem}}
      @media(max-width:560px){.personal-library-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:2.5rem .7rem}.personal-library-overlay{right:.55rem;bottom:.55rem;left:.55rem}.personal-library-overlay h2{font-size:.76rem}.personal-library-overlay span{font-size:.66rem}.personal-library-badges{top:.5rem;right:.5rem;left:.5rem}.personal-library-badges span{padding:.25rem .32rem;font-size:.42rem}}
      .personal-library-status,.personal-library-empty{padding:4rem 1rem;border:1px solid var(--color-border);color:var(--color-muted-400);text-align:center}.personal-library-empty{display:grid;justify-items:center;gap:.7rem}.personal-library-empty strong{color:var(--color-paper-50);font:500 1.1rem/1.2 var(--font-body)}.personal-library-empty span{max-width:34rem;line-height:1.55}.personal-library-empty-cta,.personal-library-load-more{display:inline-flex;margin-top:.8rem;padding:.7rem 1rem;border:1px solid var(--color-border-strong);background:transparent;color:var(--color-paper-50);font:500 .58rem/1 var(--font-meta);letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:background var(--duration-fast) var(--ease-out),color var(--duration-fast) var(--ease-out)}.personal-library-empty-cta:hover,.personal-library-load-more:hover{background:var(--color-paper-50);color:var(--color-ink-950)}.personal-library-load-more{display:flex;margin:3rem auto 0}
    `}</style>
  </div>;
}
