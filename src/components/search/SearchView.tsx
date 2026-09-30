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
  <form className="search-form" onSubmit={submit}><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Busca por título…" aria-label="Buscar anime"/><button type="submit">Buscar</button></form>
  {loading&&<p className="search-status" role="status" aria-live="polite">Buscando…</p>}
  {!loading&&submitted&&!results.length&&<p className="search-status" role="status" aria-live="polite">No encontramos resultados para «{submitted}».</p>}
  {results.length>0&&<><div className="search-grid" aria-busy={loading}>{results.map((item,index)=>{const title=item.title?.romaji||item.title?.english||"Sin título";return <article className="search-result" key={item.id}><a className="search-card" href={"/anime/search?id="+item.id+"&from=search"}><div className="search-poster"><img src={item.coverImage?.extraLarge||item.coverImage?.large||""} alt="" loading={index<6?"eager":"lazy"}/></div><div className="search-info"><h2>{title}</h2><span>{formatDate(item.startDate)} · {item.format==="MOVIE"?"Film":"Series"}</span></div></a></article>;})}</div>{hasNext&&<button className="search-more" type="button" onClick={()=>setPage(current=>current+1)} disabled={loading}>{loading?"Cargando…":"Cargar más"}</button>}</>}
 </div>;
}
