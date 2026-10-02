import {useEffect,useState} from "react";
import PersonalLibraryActions from "../personal-library/PersonalLibraryActions";

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
 relations?:{edges?:{relationType?:string|null;node?:{id:number;format?:string|null}}[]}|null;
 recommendations?:{nodes?:{mediaRecommendation?:{id:number;title?:{romaji?:string|null;english?:string|null};coverImage?:{extraLarge?:string|null;large?:string|null};format?:string|null;startDate?:{year?:number|null}|null}|null}[]};
}

const ENDPOINT="https://graphql.anilist.co";

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

function cleanDescription(text:string){
 const htmlEntityDecoder=document.createElement("textarea");
 htmlEntityDecoder.innerHTML=text
   .replace(/<br\s*\/?>/gi,"\n")
   .replace(/\\+n/g,"\n")
   .replace(/<[^>]*>/g,"");
 return (htmlEntityDecoder.value||text)
   .replace(/\u00a0/g," ")
   .replace(/\n{3,}/g,"\n\n")
   .trim();
}
function date(value:Media["startDate"]){
 if(!value?.year)return "Fecha desconocida";
 if(!value.month||!value.day)return String(value.year);
 return new Date(value.year,value.month-1,value.day).toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"});
}
function status(value:string|null|undefined){
 return value==="FINISHED"?"Finalizado":value==="RELEASING"?"En emisión":value==="NOT_YET_RELEASED"?"Próximamente":value==="HIATUS"?"En pausa":value==="CANCELLED"?"Cancelado":"";
}


function getSeasonCount(media: Media){
  if(media.format==="MOVIE") return null;
  const relatedTv=(media.relations?.edges??[])
    .filter((edge)=>edge.relationType==="PREQUEL"||edge.relationType==="SEQUEL")
    .filter((edge)=>edge.node?.format==="TV")
    .map((edge)=>edge.node?.id)
    .filter((id): id is number => typeof id==="number");
  return Math.max(1,new Set(relatedTv).size+1);
}

interface Props {
 variant?: "default" | "ghibli";
}

export default function AnimeSearchDetail({ variant = "default" }: Props){
 const[media,setMedia]=useState<Media|null>(null),[loading,setLoading]=useState(true),[translated,setTranslated]=useState(""),[translating,setTranslating]=useState(false);
 useEffect(()=>{
  const params=new URLSearchParams(location.search);
  const idParam=params.get("id");
  const id=idParam ? Number(idParam) : NaN;
  const film=params.get("film");

  if(film==="the-red-turtle" && !Number.isFinite(id)){
   const localMedia:Media={
    id:0,
    title:{english:"The Red Turtle",romaji:"The Red Turtle"},
    description:"A man is shipwrecked on a deserted island and discovers a mysterious red turtle.",
    genres:["Drama","Fantasy","Adventure"],
    startDate:{year:2016,month:9,day:17},
    format:"MOVIE",
    status:"FINISHED",
    episodes:1,
    duration:81,
    studios:{nodes:[{name:"Studio Ghibli"}]},
    coverImage:{extraLarge:"https://www.ghibli.jp/images/red-turtle.jpg",large:"https://www.ghibli.jp/images/red-turtle.jpg"},
    bannerImage:"https://www.ghibli.jp/images/red-turtle.jpg",
   };
   setMedia(localMedia);
   setLoading(false);
   return;
  }

  if(!Number.isFinite(id)){setLoading(false);return}
  fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({
   query:"query Detail($id:Int!){Media(id:$id,type:ANIME){id title{romaji english} description(asHtml:false) genres startDate{year month day} format status episodes duration studios(isMain:true){nodes{name}} coverImage{extraLarge large} bannerImage trailer{id site thumbnail} relations{edges{relationType node{id format}}} recommendations(sort:RATING_DESC,page:1,perPage:12){nodes{mediaRecommendation{id title{romaji english} coverImage{extraLarge large} format startDate{year}}}}}}",
   variables:{id}
  })}).then(r=>r.ok?r.json():Promise.reject()).then(async p=>{
   const found=p.data?.Media??null;
   if(!found)return;
   const related=await fetchAniListRecommendations(found.id);
   setMedia({...found,recommendations:{nodes:related.map((item:any)=>({mediaRecommendation:item}))}});
  }).catch(()=>{}).finally(()=>setLoading(false));
 },[]);
 if(loading)return <div className="anime-search-detail-state">Cargando ficha…</div>;
 if(!media)return <div className="anime-search-detail-state">No se ha encontrado este anime.</div>;

 const params=new URLSearchParams(location.search);
 const from=variant === "ghibli" ? "ghibli" : params.get("from");
 const title=from==="ghibli" ? (media.title?.english||media.title?.romaji||"Sin título") : (media.title?.romaji||media.title?.english||"Sin título");
 const image=media.coverImage?.extraLarge||media.coverImage?.large;
 const banner=media.bannerImage||image;
 const synopsis=media.description?cleanDescription(media.description):"";
 const hasSynopsis=synopsis.replace(/[\s\\n]+/g,"").length>0;
 const translateSynopsis=async()=>{if(!media.description||translating)return;setTranslating(true);setTranslated(await translate(media.description));setTranslating(false)};

 return <div className={"anime-detail" + (from === "ghibli" ? " anime-detail--ghibli" : "")}>
  <style>{`
    .anime-detail--ghibli{--gd-cream:#FFF7E8;--gd-paper:#F4E9D5;--gd-sky:#DCEFF1;--gd-blue:#18528A;--gd-teal:#0B798B;--gd-coral:#F45164;--gd-pink:#F0A9A5;--gd-lime:#91CC57;--gd-ink:#19362F;min-height:100vh;background:var(--gd-sky);color:var(--gd-ink)}
    .anime-detail--ghibli .anime-detail-hero{position:relative;isolation:isolate;min-height:0;background-color:var(--gd-ink)!important;background-position:center;background-size:cover}
    .anime-detail--ghibli .anime-detail-hero::before{position:absolute;inset:0;z-index:0;content:"";pointer-events:none;background:radial-gradient(ellipse 52% 72% at 69% 42%,rgba(25,54,47,.62) 0%,rgba(25,54,47,.38) 46%,rgba(25,54,47,.08) 78%,transparent 100%),linear-gradient(90deg,rgba(25,54,47,.12) 0%,rgba(25,54,47,.28) 46%,rgba(25,54,47,.06) 100%),linear-gradient(0deg,rgba(25,54,47,.34) 0%,transparent 38%)}
    .anime-detail--ghibli .anime-detail-inner{position:relative;z-index:1}
    .anime-detail--ghibli .anime-detail-copy h1{text-shadow:0 2px 18px rgba(0,0,0,.18)}
    .anime-detail--ghibli .anime-detail-copy h1{color:#fff;text-shadow:0 2px 22px rgba(0,0,0,.4)}
    .anime-detail--ghibli .anime-detail-copy-main{padding:1.15rem 1.2rem;border:1px solid rgba(255,247,232,.18);border-radius:18px;background:rgba(25,54,47,.68);box-shadow:0 16px 42px rgba(25,54,47,.22);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
    .anime-detail--ghibli .anime-detail-meta{color:rgba(255,255,255,.92);text-shadow:0 1px 8px rgba(0,0,0,.42)}
    .anime-detail--ghibli .anime-detail-meta small{color:rgba(255,255,255,.76);text-shadow:0 1px 6px rgba(0,0,0,.42)}
    .anime-detail--ghibli .anime-detail-meta strong{color:#fff;text-shadow:0 1px 8px rgba(0,0,0,.42)}
    .anime-detail--ghibli .anime-detail-genres span{border-color:rgba(255,255,255,.25);color:#fff;background:rgba(25,54,47,.35)}
    .anime-detail--ghibli .anime-detail-synopsis-wrap{
      max-width:42rem;
      margin-top:1.35rem;
      padding:1rem 1.15rem 1.1rem;
      border:1px solid rgba(255,247,232,.22);
      border-radius:14px;
      background:rgba(25,54,47,.42);
      box-shadow:0 12px 34px rgba(25,54,47,.14);
      -webkit-backdrop-filter:blur(8px);
      backdrop-filter:blur(8px);
    }
    .anime-detail--ghibli .anime-detail-synopsis{margin:0;color:#fff}
    .anime-detail--ghibli .anime-detail-translate{border-color:rgba(255,247,232,.45);background:rgba(255,247,232,.12);color:#fff}
    .anime-detail--ghibli .anime-detail-translate:hover:not(:disabled){background:#fff;color:var(--gd-blue)}
    .anime-detail--ghibli .anime-detail-state span{color:#a7df72;text-shadow:0 1px 7px rgba(25,54,47,.62)}
    .anime-detail--ghibli .personal-actions button,.anime-detail--ghibli .personal-status{border-color:rgba(255,255,255,.34);background:rgba(25,54,47,.28);color:#fff;-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);text-shadow:0 1px 5px rgba(0,0,0,.32)}
    .anime-detail--ghibli .personal-actions button:hover,.anime-detail--ghibli .personal-actions button.is-active{background:#fff;color:var(--gd-blue);text-shadow:none}
    .anime-detail--ghibli .anime-detail-info{border-top:0;background:var(--gd-teal);padding:0;width:100%}
    .anime-detail--ghibli .anime-detail-info>div{background:var(--gd-teal);color:#fff;width:100%;border-top:1px solid rgba(255,255,255,.2)}
    .anime-detail--ghibli .anime-detail-info>div:first-child{border-top:0}
    .anime-detail--ghibli .anime-detail-info strong{color:#fff}
    .anime-detail--ghibli .anime-detail-label{color:rgba(255,255,255,.68)}
    .anime-detail--ghibli .anime-detail-trailer>.anime-detail-label{color:rgba(255,255,255,.78)}
    .anime-detail--ghibli .anime-detail-video{border-color:rgba(25,54,47,.12);background:#19362F}
    body:has(.anime-detail--ghibli){background:var(--gd-blue);color:#fff}
    body:has(.anime-detail--ghibli) .site-footer{background:#fff;color:var(--gd-ink)}
    body:has(.anime-detail--ghibli) .site-footer .footer-line{background:rgba(25,54,47,.14)}
    body:has(.anime-detail--ghibli) .site-footer .closing{color:var(--gd-ink)}
    body:has(.anime-detail--ghibli) .site-footer .thanks{color:#59756b}
    body:has(.anime-detail--ghibli) .site-footer .footer-meta{color:#6b7d76}
    .anime-detail-recommendations{grid-column:1 / -1;margin-top:1.25rem;width:100%;min-width:0}
    .anime-detail-recommendations-head{display:flex;align-items:baseline;justify-content:space-between;gap:1rem;margin-bottom:.7rem}
    .anime-detail-recommendations-track{display:flex;gap:.7rem;min-height:0;overflow-x:auto;padding:.15rem 0 .65rem;scroll-snap-type:x mandatory;scrollbar-width:thin;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}
    .anime-detail-recommendation{flex:0 0 clamp(116px,30vw,138px);scroll-snap-align:start;color:inherit;text-decoration:none}
    .anime-detail-recommendation-poster{aspect-ratio:2/3;overflow:hidden;background:#171717;border-radius:8px;border:1px solid rgba(255,255,255,.14)}
    .anime-detail-recommendation-poster img{display:block;width:100%;height:100%;object-fit:cover;transition:transform 320ms cubic-bezier(.22,1,.36,1)}
    .anime-detail-recommendation:hover .anime-detail-recommendation-poster img{transform:scale(1.035)}
    .anime-detail-recommendation-title{display:block;margin-top:.48rem;font-size:.72rem;line-height:1.25;font-weight:500}
    .anime-detail-recommendation-meta{display:block;margin-top:.22rem;font-family:var(--font-meta);font-size:.5rem;letter-spacing:.06em;text-transform:uppercase;opacity:.58}
    .anime-detail--ghibli .anime-detail-recommendation-poster{border-radius:12px;background:var(--gd-ink)}
    .anime-detail--ghibli .anime-detail-recommendation-title{color:#fff}
    .anime-detail--ghibli .anime-detail-recommendation-meta{color:rgba(255,255,255,.68)}
    @media(max-width:760px){
      .anime-detail-recommendations{grid-column:1 / -1;width:100%;margin-top:1.35rem}
      .anime-detail-recommendations-track{width:100%;max-width:none}
      .anime-detail-recommendation{flex-basis:104px}
      .anime-detail-recommendations-head{margin-bottom:.85rem}
      .anime-detail-recommendation{flex-basis:116px}
      .anime-detail-recommendation-title{font-size:.68rem}
    }
    @media(max-width:760px){
      .anime-detail--ghibli .anime-detail-copy-main{padding:.95rem;border-radius:15px;background:rgba(25,54,47,.74)}
      .anime-detail--ghibli .anime-detail-synopsis-wrap{
        margin-top:1rem;
        padding:.85rem .9rem .95rem;
        border-radius:12px;
      }
    }
  `}</style>
  <section className="anime-detail-hero" style={banner?{backgroundImage:from==="ghibli"?'url("'+banner+'")':'linear-gradient(90deg,rgba(9,9,9,.98),rgba(9,9,9,.72) 45%,rgba(9,9,9,.35) 75%,rgba(9,9,9,.8)),linear-gradient(0deg,rgba(9,9,9,.98),transparent 45%),url("'+banner+'")'}:undefined}>
   <div className="anime-detail-inner">
    <div className={"anime-detail-layout"+(title.length>24?" has-long-title":"")}>
     <div className="anime-detail-poster">{image?<img src={image} alt={title}/>:<div className="anime-detail-placeholder">RENANIME</div>}</div>

     <div className="anime-detail-copy">
      <div className="anime-detail-copy-main">
       <h1>{title}</h1>
       <div className="anime-detail-meta">
        <span className="anime-detail-meta-type"><strong>{media.format==="MOVIE"?"Película":"Serie"}</strong></span>
        <span><small>LANZAMIENTO</small><strong>{date(media.startDate)}</strong></span>
        {media.format!=="MOVIE"&&media.episodes&&<span><small>EPISODIOS</small><strong>{media.episodes}</strong></span>}
        {media.duration&&<span><small>{media.format==="MOVIE"?"DURACIÓN":"DURACIÓN / EPISODIO"}</small><strong>{media.duration} min</strong></span>}
        {media.format!=="MOVIE"&&getSeasonCount(media)&&<span><small>TEMPORADAS</small><strong>{getSeasonCount(media)}</strong></span>}
       </div>
     {media.id > 0 && <div className="anime-detail-library-actions"><PersonalLibraryActions animeId={media.id} /></div>}
       {media.genres?.length&&<div className="anime-detail-genres">{media.genres.slice(0,5).map(genre=><span key={genre}>{genre}</span>)}</div>}
       {media.format!=="MOVIE"&&<div className="anime-detail-state">{status(media.status)&&<span>{status(media.status)}</span>}</div>
      </div>
     </div>

     <div className="anime-detail-synopsis-wrap">
      <span className="anime-detail-label">Sinopsis</span>
      <p className="anime-detail-synopsis">{translated||synopsis||(hasSynopsis?"":"Todavía no hay una sinopsis disponible.")}</p>
      {hasSynopsis&&media.description&&<button type="button" className="anime-detail-translate" onClick={translateSynopsis} disabled={translating}>{translating?"Traduciendo…":translated?"Traducido al español":"Traducir al español"}</button>}
     </div>

     {media.trailer?.id&&media.trailer.site==="youtube"&&<section className="anime-detail-trailer"><span className="anime-detail-label">Tráiler</span><div className="anime-detail-video"><iframe src={"https://www.youtube.com/embed/"+media.trailer.id+"?rel=0"} title={"Tráiler de "+title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div></section>}

     {(() => {
       const seen = new Set<number>();
       const items = (media.recommendations?.nodes ?? [])
        .map((node) => node.mediaRecommendation)
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .filter((item) => item.id !== media.id && !seen.has(item.id) && seen.add(item.id))
        .slice(0, 8);
       return <section className="anime-detail-recommendations" aria-label="Recomendaciones">
        <div className="anime-detail-recommendations-head">
         <span className="anime-detail-label">Si has visto este anime, tal vez te guste…</span>
        </div>
        <div className="anime-detail-recommendations-track">
         {items.length ? items.map((item) => {
          const recTitle=item.title?.romaji||item.title?.english||"Sin título";
          const recImage=item.coverImage?.extraLarge||item.coverImage?.large;
          return <a className="anime-detail-recommendation" href={"/anime/search?id="+item.id+"&from="+(from==="ghibli"?"ghibli":"anime")} key={item.id}>
           <div className="anime-detail-recommendation-poster">{recImage&&<img src={recImage} alt={recTitle} loading="lazy" />}</div>
           <span className="anime-detail-recommendation-title">{recTitle}</span>
           <span className="anime-detail-recommendation-meta">{item.format==="MOVIE"?"Film":"Series"}{item.startDate?.year?" · "+item.startDate.year:""}</span>
          </a>;
         }) : null}
        </div>
       </section>;
      })()}
    </div>
   </div>
  </section>
  <section className="anime-detail-info">
   <div><span className="anime-detail-label">Información</span><strong>{media.studios?.nodes?.map(studio=>studio.name).join(" · ")||"Estudio no disponible"}</strong></div>
   <div><span className="anime-detail-label">Formato</span><strong>{media.format==="MOVIE"?"Película":"Serie"}</strong></div>
  </section>
 </div>;
}
