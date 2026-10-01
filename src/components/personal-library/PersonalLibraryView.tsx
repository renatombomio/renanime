import { useEffect, useMemo, useState } from "react";
import type { PersonalAnimeEntry } from "../../types/personal";
import { getPersonalLibrary, subscribeToPersonalLibrary } from "../../data/personal-library";

type Mode = "WATCHED" | "PENDING";
type Filter = "ALL" | "SERIES" | "MOVIES";
type Sort = "ADDED" | "TITLE" | "YEAR" | "SCORE";

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
  const [filter,setFilter]=useState<Filter>("ALL");
  const [sort,setSort]=useState<Sort>("ADDED");
  const [query,setQuery]=useState("");
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

  const filteredEntries=useMemo(()=>{
    const normalized=query.trim().toLocaleLowerCase("es");
    const next=entries.filter(entry=>{
      const item=media[entry.animeId];
      const movie=isMovie(item);
      if(filter==="MOVIES"&&!movie)return false;
      if(filter==="SERIES"&&movie)return false;
      if(normalized&&!titleOf(item).toLocaleLowerCase("es").includes(normalized))return false;
      return true;
    });
    return [...next].sort((a,b)=>{
      const aMedia=media[a.animeId]; const bMedia=media[b.animeId];
      if(sort==="TITLE")return titleOf(aMedia).localeCompare(titleOf(bMedia),"es");
      if(sort==="YEAR")return (bMedia?.startDate?.year??0)-(aMedia?.startDate?.year??0);
      if(sort==="SCORE")return (b.state.personalScore??-1)-(a.state.personalScore??-1);
      return entries.indexOf(a)-entries.indexOf(b);
    });
  },[entries,media,filter,sort,query]);

  useEffect(()=>{setVisible(PAGE_SIZE);},[filter,sort,query,mode]);

  const visibleEntries=filteredEntries.slice(0,visible);
  const hasMore=visible<filteredEntries.length;

  if(loading&&!entries.length)return <p className="personal-library-status">Cargando mi biblioteca…</p>;

  return <div className="personal-library-view">
    <div className="personal-library-toolbar">
      <div className="personal-library-filters" role="tablist" aria-label="Filtrar colección">
        {(["ALL","SERIES","MOVIES"] as Filter[]).map(value=><button key={value} type="button" className={filter===value?"is-active":""} aria-selected={filter===value} role="tab" onClick={()=>setFilter(value)}>{value==="ALL"?"Todos":value==="SERIES"?"Series":"Películas"}</button>)}
      </div>
      <div className="personal-library-tools">
        <label className="sr-only" htmlFor={`library-search-${mode}`}>Buscar en mi colección</label>
        <input id={`library-search-${mode}`} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar…" type="search" />
        <label className="sr-only" htmlFor={`library-sort-${mode}`}>Ordenar colección</label>
        <select id={`library-sort-${mode}`} value={sort} onChange={event=>setSort(event.target.value as Sort)}>
          <option value="ADDED">Añadidos</option>
          <option value="TITLE">Título A–Z</option>
          <option value="YEAR">Más recientes</option>
          <option value="SCORE">Mi puntuación</option>
        </select>
      </div>
    </div>

    <div className="personal-library-count" aria-live="polite">
      {filteredEntries.length} {filteredEntries.length===1?"anime":"animes"}
      {query||filter!=="ALL"?` · ${entries.length} en total`:""}
    </div>

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
              <div className="personal-library-badges" aria-hidden="true">
                {entry.state.favorite&&<span>Favorito</span>}
                {entry.state.recommended&&<span>Recomendado</span>}
                {score!=null&&<span>★ {score}</span>}
              </div>
            </div>
            <div className="personal-library-info">
              <h2>{title}</h2>
              <span>{formatDate(item?.startDate)} · {isMovie(item)?"Película":"Serie"}</span>
            </div>
          </a>
        </article>;
      })}
    </div>:<div className="personal-library-empty">
      <strong>{query||filter!=="ALL"?"No hay resultados en este filtro.":mode==="WATCHED"?"¿Qué, todavía no has visto anime?":"Esto está igual de vacío que tu corazón."}</strong>
      <span>{query||filter!=="ALL"?"Prueba otra búsqueda o cambia el filtro.":mode==="WATCHED"?"¿No sabes lo que te estás perdiendo? Venga, anímate, que me hace falta más gente friki por aquí. 😂":"Venga va, dame cariño y mete algún anime en la lista. Gracias. No leo lloros. 🫶"}</span>
      {!query&&filter==="ALL"&&<a className="personal-library-empty-cta" href="/search/">{mode==="WATCHED"?"Explorar anime →":"Buscar algo que ver →"}</a>}
    </div>}

    {hasMore&&<button type="button" className="personal-library-load-more" onClick={()=>setVisible(value=>Math.min(value+PAGE_SIZE,filteredEntries.length))}>Cargar más · {filteredEntries.length-visible} restantes</button>}

    <style>{`
      .personal-library-view{width:100%}
      .personal-library-toolbar{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:1.5rem;padding-bottom:1.25rem;border-bottom:1px solid var(--color-border)}
      .personal-library-filters{display:flex;gap:1.15rem;overflow-x:auto;scrollbar-width:none}.personal-library-filters::-webkit-scrollbar{display:none}
      .personal-library-filters button{position:relative;flex:0 0 auto;padding:.65rem 0 .7rem;border:0;background:transparent;color:var(--color-muted-400);font:500 .65rem/1 var(--font-meta);letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
      .personal-library-filters button::after{position:absolute;right:0;bottom:0;left:0;height:1px;background:var(--color-paper-50);content:"";transform:scaleX(0);transform-origin:center;transition:transform var(--duration-fast) var(--ease-out)}
      .personal-library-filters button:hover,.personal-library-filters button.is-active{color:var(--color-paper-50)}.personal-library-filters button.is-active::after{transform:scaleX(1)}
      .personal-library-tools{display:flex;justify-content:flex-end;gap:.5rem}.personal-library-tools input,.personal-library-tools select{min-height:2.5rem;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-ink-900);color:var(--color-paper-50);padding:.65rem .8rem;font:400 .8rem/1 var(--font-body);outline:none}.personal-library-tools input{width:min(16rem,100%)}.personal-library-tools input:focus,.personal-library-tools select:focus{border-color:var(--color-border-strong)}
      .personal-library-count{margin:1rem 0 2rem;color:var(--color-muted-400);font:500 .62rem/1 var(--font-meta);letter-spacing:.08em;text-transform:uppercase}
      .personal-library-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:clamp(3rem,5vw,5rem) clamp(.85rem,1.8vw,1.75rem)}.personal-library-card{min-width:0}
      .personal-library-link{display:block;color:inherit}.personal-library-poster{position:relative;aspect-ratio:2/3;overflow:hidden;background:var(--color-ink-800)}.personal-library-poster img{display:block;width:100%;height:100%;object-fit:cover;transition:transform var(--duration-slow) var(--ease-out),filter var(--duration-base) var(--ease-out)}.personal-library-link:hover .personal-library-poster img{transform:scale(1.035);filter:saturate(1.04)}
      .personal-library-poster::after{position:absolute;inset:0;background:linear-gradient(180deg,rgba(9,9,9,.02) 45%,rgba(9,9,9,.78) 100%);content:"";pointer-events:none}
      .personal-library-placeholder{width:100%;height:100%;background:radial-gradient(circle at 18% 18%,rgba(245,242,236,.08),transparent 38%),linear-gradient(145deg,var(--color-ink-700),var(--color-ink-950))}
      .personal-library-badges{position:absolute;right:.6rem;bottom:.6rem;left:.6rem;z-index:1;display:flex;flex-wrap:wrap;gap:.35rem}.personal-library-badges span{padding:.3rem .4rem;border:1px solid rgba(245,242,236,.22);background:rgba(9,9,9,.55);backdrop-filter:blur(8px);color:var(--color-paper-50);font:500 .48rem/1 var(--font-meta);letter-spacing:.06em;text-transform:uppercase}
      .personal-library-info{display:grid;gap:.35rem;padding-top:.7rem}.personal-library-info h2{display:-webkit-box;overflow:hidden;margin:0;color:var(--color-paper-50);font:500 .82rem/1.2 var(--font-body);-webkit-box-orient:vertical;-webkit-line-clamp:2}.personal-library-info span{color:var(--color-muted-400);font:500 .52rem/1.2 var(--font-meta);letter-spacing:.04em;text-transform:uppercase}
      .personal-library-status,.personal-library-empty{padding:4rem 1rem;border:1px solid var(--color-border);color:var(--color-muted-400);text-align:center}.personal-library-empty{display:grid;justify-items:center;gap:.7rem}.personal-library-empty strong{color:var(--color-paper-50);font:500 1.1rem/1.2 var(--font-body)}.personal-library-empty span{max-width:34rem;line-height:1.55}.personal-library-empty-cta,.personal-library-load-more{display:inline-flex;margin-top:.8rem;padding:.7rem 1rem;border:1px solid var(--color-border-strong);background:transparent;color:var(--color-paper-50);font:500 .58rem/1 var(--font-meta);letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:background var(--duration-fast) var(--ease-out),color var(--duration-fast) var(--ease-out)}.personal-library-empty-cta:hover,.personal-library-load-more:hover{background:var(--color-paper-50);color:var(--color-ink-950)}.personal-library-load-more{display:flex;margin:3rem auto 0}
      .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
      @media(max-width:1100px){.personal-library-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
      @media(max-width:800px){.personal-library-toolbar{grid-template-columns:1fr;align-items:stretch}.personal-library-tools{justify-content:stretch}.personal-library-tools input{flex:1;width:auto}.personal-library-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:560px){.personal-library-tools{display:grid;grid-template-columns:minmax(0,1fr) auto}.personal-library-tools select{max-width:8rem}.personal-library-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:2.25rem .65rem}.personal-library-info h2{font-size:.72rem}.personal-library-info span{font-size:.46rem}.personal-library-badges{right:.4rem;bottom:.4rem;left:.4rem}.personal-library-badges span{padding:.25rem .3rem;font-size:.4rem}}
      @media(prefers-reduced-motion:reduce){.personal-library-poster img{transition:none}.personal-library-link:hover .personal-library-poster img{transform:none}}
    `}</style>
  </div>;
}
