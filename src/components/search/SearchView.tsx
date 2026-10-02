import { useEffect, useState, type FormEvent } from "react";
interface Media { id:number; title?:{romaji?:string|null;english?:string|null}; startDate?:{year?:number|null;month?:number|null;day?:number|null}|null; coverImage?:{extraLarge?:string|null;large?:string|null}; format?:string|null; }
const PAGE_SIZE=12;
function formatDate(date:Media["startDate"]){if(!date?.year)return "Fecha desconocida";if(!date.month||!date.day)return String(date.year);return new Date(date.year,date.month-1,date.day).toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"});}
export default function SearchView(){
 const [query,setQuery]=useState(""),[submitted,setSubmitted]=useState(""),[results,setResults]=useState<Media[]>([]),[page,setPage]=useState(1),[hasNext,setHasNext]=useState(false),[loading,setLoading]=useState(false);
 useEffect(()=>{if(!submitted.trim()){setResults([]);setHasNext(false);return;}let cancelled=false;setLoading(true);
 fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query:"query Search($search:String!,$page:Int!,$perPage:Int!){Page(page:$page,perPage:$perPage){pageInfo{hasNextPage} media(search:$search,type:ANIME,sort:SEARCH_MATCH){id title{romaji english} startDate{year month day} coverImage{extraLarge large} format}}}",variables:{search:submitted,page,perPage:PAGE_SIZE}})})
 .then(r=>r.ok?r.json():Promise.reject()).then(payload=>{if(cancelled)return;const media=payload.data?.Page?.media??[];setResults(current=>page===1?media:[...current,...media]);setHasNext(Boolean(payload.data?.Page?.pageInfo?.hasNextPage));}).catch(()=>{if(!cancelled&&page===1)setResults([]);}).finally(()=>{if(!cancelled)setLoading(false);});
 return()=>{cancelled=true;};},[submitted,page]);
 const submit=(event:FormEvent)=>{event.preventDefault();setPage(1);setSubmitted(query.trim());};
 return <div className="search-view">
  <style>{`
    .search-view{width:100%}
    .search-form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.6rem;align-items:stretch;margin-bottom:2rem}
    .search-form input{min-width:0;height:2.7rem;padding:.65rem .75rem;border:1px solid var(--color-border-strong);border-radius:0;background:var(--color-ink-900);color:var(--color-paper-50);font-size:.85rem;outline:none}
    .search-form input:focus{border-color:var(--color-paper-50)}
    .search-form button,.search-more{height:2.7rem;padding:.65rem .9rem;border:1px solid var(--color-border-strong);background:transparent;color:var(--color-paper-50);font-family:var(--font-meta);font-size:.55rem;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
    .search-form button:hover,.search-more:hover:not(:disabled){background:var(--color-paper-50);color:var(--color-ink-950)}
    .search-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:2.5rem 1rem}
    .search-result{min-width:0}
    .search-card{display:block;min-width:0;color:inherit}
    .search-poster{position:relative;aspect-ratio:2/3;overflow:hidden;border:1px solid rgba(245,242,236,.13);border-radius:10px;background:var(--color-ink-800);box-shadow:0 12px 34px rgba(0,0,0,.18)}
    .search-poster img{display:block;width:100%;height:100%;object-fit:cover;transition:transform 500ms cubic-bezier(.2,.7,.2,1)}
    .search-card:hover .search-poster img{transform:scale(1.035)}
    .search-info{display:grid;gap:.3rem;padding:.65rem .1rem 0}
    .search-info h2{display:-webkit-box;overflow:hidden;margin:0;color:var(--color-paper-50);font-family:var(--font-body);font-size:.72rem;font-weight:500;line-height:1.25;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .search-info span{color:var(--color-muted-400);font-family:var(--font-meta);font-size:.48rem;letter-spacing:.05em;text-transform:uppercase}
    .search-status{color:var(--color-muted-400);font-family:var(--font-meta);font-size:.55rem;letter-spacing:.06em;text-transform:uppercase}
    .search-more{display:block;margin:2.5rem auto 0}
    @media(max-width:1100px){.search-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
    @media(max-width:760px){.search-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:1.8rem .7rem}.search-form{margin-bottom:1.5rem}.search-info{padding-top:.55rem}.search-info h2{font-size:.68rem}.search-info span{font-size:.45rem}}
    @media(max-width:520px){.search-page{padding-top:5.5rem}.search-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:1.6rem .55rem}.search-poster{border-radius:8px}.search-info h2{font-size:.65rem}.search-info span{font-size:.43rem}.search-form{grid-template-columns:minmax(0,1fr) auto;gap:.4rem}.search-form button{padding-inline:.7rem}}
  `}</style>
  <form className="search-form" onSubmit={submit}><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Busca por título…" aria-label="Buscar anime"/><button type="submit">Buscar</button></form>
  {loading&&<p className="search-status" role="status" aria-live="polite">Buscando…</p>}
  {!loading&&submitted&&!results.length&&<p className="search-status" role="status" aria-live="polite">No encontramos resultados para «{submitted}».</p>}
  {results.length>0&&<><div className="search-grid" aria-busy={loading}>{results.map((item,index)=>{const title=item.title?.romaji||item.title?.english||"Sin título";return <article className="search-result" key={item.id}><a className="search-card" href={"/anime/search?id="+item.id+"&from=search"}><div className="search-poster"><img src={item.coverImage?.extraLarge||item.coverImage?.large||""} alt="" loading={index<6?"eager":"lazy"}/></div><div className="search-info"><h2>{title}</h2><span>{formatDate(item.startDate)} · {item.format==="MOVIE"?"Film":"Series"}</span></div></a></article>;})}</div>{hasNext&&<button className="search-more" type="button" onClick={()=>setPage(current=>current+1)} disabled={loading}>{loading?"Cargando…":"Cargar más"}</button>}</>}
 </div>;
}
