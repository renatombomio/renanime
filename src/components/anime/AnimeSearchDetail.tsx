import {useEffect,useState} from "react";

interface Media{
 id:number;
 title?:{romaji?:string|null;english?:string|null};
 description?:string|null;
 genres?:string[];
 startDate?:{year?:number|null;month?:number|null;day?:number|null}|null;
 format?:string|null;
 status?:string|null;
 episodes?:number|null;
 duration?:number|null;
 studios?:{nodes?:{name:string}[]};
 coverImage?:{extraLarge?:string|null;large?:string|null};
 bannerImage?:string|null;
 trailer?:{id?:string|null;site?:string|null;thumbnail?:string|null}|null;
}

function cleanDescription(text:string){
 return text.replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\n{3,}/g,"\n\n").trim();
}
function date(value:Media["startDate"]){
 if(!value?.year)return "Fecha desconocida";
 if(!value.month||!value.day)return String(value.year);
 return new Date(value.year,value.month-1,value.day).toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"});
}
function status(value:string|null|undefined){
 return value==="FINISHED"?"Finalizado":value==="RELEASING"?"En emisión":value==="NOT_YET_RELEASED"?"Próximamente":value==="HIATUS"?"En pausa":value==="CANCELLED"?"Cancelado":"";
}
async function translate(text:string){
 const clean=cleanDescription(text);
 const chunks:string[]=[];let rest=clean;
 while(rest){
  if(new TextEncoder().encode(rest).length<=450){chunks.push(rest);break;}
  let cut=450;while(cut>100&&new TextEncoder().encode(rest.slice(0,cut)).length>450)cut-=10;
  const window=rest.slice(0,cut);const boundary=Math.max(window.lastIndexOf(". "),window.lastIndexOf("! "),window.lastIndexOf("? "),window.lastIndexOf(" "));
  const size=boundary>120?boundary:cut;chunks.push(rest.slice(0,size).trim());rest=rest.slice(size).trim();
 }
 const out:string[]=[];
 for(const chunk of chunks){
  try{
   const response=await fetch("https://api.mymemory.translated.net/get?"+new URLSearchParams({q:chunk,langpair:"en|es",mt:"1"}));
   const payload=await response.json();out.push(payload.responseData?.translatedText||chunk);
  }catch{out.push(chunk)}
 }
 return out.join(" ");
}

export default function AnimeSearchDetail(){
 const[media,setMedia]=useState<Media|null>(null),[loading,setLoading]=useState(true),[translated,setTranslated]=useState(""),[translating,setTranslating]=useState(false);
 useEffect(()=>{
  const id=Number(new URLSearchParams(location.search).get("id"));
  if(!Number.isFinite(id)){setLoading(false);return}
  fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({
   query:"query Detail($id:Int!){Media(id:$id,type:ANIME){id title{romaji english} description(asHtml:false) genres startDate{year month day} format status episodes duration studios(isMain:true){nodes{name}} coverImage{extraLarge large} bannerImage trailer{id site thumbnail}}}",
   variables:{id}
  })}).then(r=>r.ok?r.json():Promise.reject()).then(p=>setMedia(p.data?.Media??null)).catch(()=>{}).finally(()=>setLoading(false));
 },[]);
 if(loading)return <div className="anime-search-detail-state">Cargando ficha…</div>;
 if(!media)return <div className="anime-search-detail-state">No se ha encontrado este anime.</div>;

 const params=new URLSearchParams(location.search);
 const from=params.get("from");
 const requestedBack=params.get("back");
 const backHref=from==="ghibli"?"/ghibli/":from==="coming-soon"?"/coming-soon/":from==="anime"&&requestedBack?.startsWith("/anime/")?requestedBack:"/search/";
 const backLabel=from==="ghibli"?"Volver a El secreto de Ren":from==="coming-soon"?"Volver a próximamente":from==="anime"?"Volver al anime":"Volver a buscar";
 const title=media.title?.romaji||media.title?.english||"Sin título";
 const image=media.coverImage?.extraLarge||media.coverImage?.large;
 const banner=media.bannerImage||image;
 const synopsis=media.description?cleanDescription(media.description):"";
 const translateSynopsis=async()=>{if(!media.description||translating)return;setTranslating(true);setTranslated(await translate(media.description));setTranslating(false)};

 return <div className="anime-detail">
  <section className="anime-detail-hero" style={banner?{backgroundImage:`linear-gradient(90deg,rgba(9,9,9,.98),rgba(9,9,9,.72) 45%,rgba(9,9,9,.35) 75%,rgba(9,9,9,.8)),linear-gradient(0deg,rgba(9,9,9,.98),transparent 45%),url("${banner}")`}:undefined}>
   <div className="anime-detail-inner">
    <a className="anime-detail-back" href={backHref}>← {backLabel}</a>
    <div className="anime-detail-layout">
     <div className="anime-detail-poster">{image?<img src={image} alt={title}/>:<div className="anime-detail-placeholder">RENANIME</div>}</div>
     <div className="anime-detail-copy">
      <h1>{title}</h1>
      <div className="anime-detail-meta"><span>{media.format==="MOVIE"?"Film":"Series"}</span><span>{date(media.startDate)}</span>{media.episodes&&<span>{media.episodes} episodios</span>}{media.duration&&<span>{media.duration} min</span>}</div>
      {media.genres?.length&&<div className="anime-detail-genres">{media.genres.slice(0,5).map(genre=><span key={genre}>{genre}</span>)}</div>}
      <div className="anime-detail-synopsis-wrap">
       <p className="anime-detail-synopsis">{translated||synopsis||"Todavía no hay una sinopsis disponible."}</p>
       {media.description&&<button type="button" className="anime-detail-translate" onClick={translateSynopsis} disabled={translating}>{translating?"Traduciendo…":translated?"Traducido al español":"Traducir al español"}</button>}
      </div>
      {media.trailer?.id&&media.trailer.site==="youtube"&&<section className="anime-detail-trailer"><span className="anime-detail-label">Tráiler</span><div className="anime-detail-video"><iframe src={"https://www.youtube.com/embed/"+media.trailer.id+"?rel=0"} title={"Tráiler de "+title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div></section>}
      <div className="anime-detail-state">{status(media.status)&&<span>{status(media.status)}</span>}</div>
     </div>
    </div>
   </div>
  </section>
  <section className="anime-detail-info">
   <div><span className="anime-detail-label">Información</span><strong>{media.studios?.nodes?.map(studio=>studio.name).join(" · ")||"Estudio no disponible"}</strong></div>
   <div><span className="anime-detail-label">Formato</span><strong>{media.format==="MOVIE"?"Película":"Serie"}</strong></div>
  </section>
 </div>;
}
