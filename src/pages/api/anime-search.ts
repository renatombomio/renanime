import type { APIRoute } from "astro";
import { jikanProvider } from "../../lib/api/jikan";

const ENDPOINT = "https://graphql.anilist.co";
const PAGE_SIZE = 24;
const MAX_PAGE = 10;
const GENRES = new Set(["Action","Adventure","Comedy","Drama","Fantasy","Horror","Mahou Shoujo","Mecha","Music","Mystery","Psychological","Romance","Sci-Fi","Slice of Life","Sports","Supernatural","Thriller"]);
const FIELDS = "id title { romaji english } startDate { year month day } coverImage { extraLarge large } format genres seasonYear status averageScore";
const FLD_CACHE = "public, max-age=0, s-maxage=600, stale-while-revalidate=3600";
const SRCH_CACHE = "public, max-age=0, s-maxage=120, stale-while-revalidate=900";
type Media = { id:number; title?:{romaji?:string|null;english?:string|null}; startDate?:{year?:number|null;month?:number|null;day?:number|null}|null; coverImage?:{extraLarge?:string|null;large?:string|null}; format?:string|null; genres?:string[]; seasonYear?:number|null; status?:string|null; averageScore?:number|null };
type Data = {items:Media[];total:number;hasNextPage:boolean;source:string};
const pending = new Map<string,Promise<Data>>();
function fail(error:string,status:number,retry?:string){const headers=new Headers({"Cache-Control":"no-store"});if(retry)headers.set("Retry-After",retry);return Response.json({success:false,error},{status,headers});}
async function anilist(query:string,variables:Record<string,unknown>){
 const r=await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(10000)});
 if(r.status===429)throw Object.assign(new Error("RATE_LIMIT"),{status:429,retry:r.headers.get("Retry-After")||"30"});
 if(!r.ok)throw new Error("ANILIST_HTTP_"+r.status);
 const p=await r.json();
 if(p.errors?.length||!p.data?.Page||!Array.isArray(p.data.Page.media))throw new Error("ANILIST_INVALID_RESPONSE");
 return p.data.Page;
}
async function searchAnime(q:string,page:number):Promise<Data>{
 const query="query SearchAnime($search:String!,$page:Int!,$perPage:Int!){Page(page:$page,perPage:$perPage){pageInfo{total hasNextPage} media(search:$search,type:ANIME,sort:SEARCH_MATCH,isAdult:false){"+FIELDS+"}}}";
 try{const p=await anilist(query,{search:q,page,perPage:PAGE_SIZE});return{items:p.media,total:p.pageInfo?.total??0,hasNextPage:Boolean(p.pageInfo?.hasNextPage),source:"anilist"};}
 catch(e){if((e as {status?:number}).status===429)throw e;const entries=await jikanProvider.search({query:q,page,perPage:PAGE_SIZE});const items:Media[]=entries.map(x=>({id:x.external.mal??Number(x.id.replace("mal-","")),title:{romaji:x.metadata.title,english:x.metadata.title},startDate:x.metadata.year?{year:x.metadata.year}:null,coverImage:x.metadata.images.cover?{extraLarge:x.metadata.images.cover,large:x.metadata.images.cover}:undefined,format:x.metadata.format}));return{items,total:items.length,hasNextPage:false,source:"jikan"};}
}
async function filterAnime(genres:string[],year:string,status:string,page:number):Promise<Data>{
 const y=year&&year!=="before-2016"?Number(year):null;
 const after=y?y*10000:null,before=y?(y+1)*10000:year==="before-2016"?20160000:null;
 const query="query FilterAnime($genres:[String],$status:MediaStatus,$after:FuzzyDateInt,$before:FuzzyDateInt,$page:Int!,$perPage:Int!){Page(page:$page,perPage:$perPage){pageInfo{total hasNextPage} media(type:ANIME,genre_in:$genres,status:$status,startDate_greater:$after,startDate_lesser:$before,sort:POPULARITY_DESC,isAdult:false){"+FIELDS+"}}}";
 const p=await anilist(query,{genres:genres.length?genres:null,status:status||null,after,before,page,perPage:PAGE_SIZE});
 return{items:p.media,total:p.pageInfo?.total??0,hasNextPage:Boolean(p.pageInfo?.hasNextPage),source:"anilist"};
}
export const GET:APIRoute=async({request})=>{
 const p=new URL(request.url).searchParams,q=(p.get("q")||"").trim().replace(/\s+/g," "),page=Number(p.get("page")||"1");
 const genres=[...new Set(p.getAll("genre").map(x=>x.trim()))].sort(),year=p.get("year")||"",status=p.get("status")||"",now=new Date().getFullYear();
 if(!Number.isInteger(page)||page<1||page>MAX_PAGE)return fail("INVALID_PAGE",400);
 if(q.length>80||(q&&q.length<2))return fail("INVALID_QUERY",400);
 if(genres.some(x=>!GENRES.has(x)))return fail("INVALID_GENRE",400);
 if(year&&year!=="before-2016"&&(!/^\d{4}$/.test(year)||Number(year)<now-9||Number(year)>now))return fail("INVALID_YEAR",400);
 if(status&&!["FINISHED","RELEASING"].includes(status))return fail("INVALID_STATUS",400);
 if(q&&(genres.length||year||status))return fail("SEARCH_AND_FILTERS_ARE_MUTUALLY_EXCLUSIVE",400);
 const isSearch=q.length>=2;
 if(!isSearch&&!genres.length&&!year&&!status)return fail("MISSING_SEARCH_OR_FILTER",400);
 const key=isSearch?"q:"+q.toLowerCase()+":"+page:"f:"+genres.join(",")+":"+year+":"+status+":"+page;
 const cache=isSearch?SRCH_CACHE:FLD_CACHE;
 try{
  let job=pending.get(key);
  if(!job){job=isSearch?searchAnime(q,page):filterAnime(genres,year,status,page);pending.set(key,job);}
  let data:Data;
  try{data=await job;}finally{if(pending.get(key)===job)pending.delete(key);}
  return Response.json({success:true,...data},{headers:{"Cache-Control":cache,"Vercel-CDN-Cache-Control":cache,"X-Renanime-Search-Source":data.source}});
 }catch(e){const limited=(e as {status?:number}).status===429;return fail(limited?"SEARCH_PROVIDER_RATE_LIMITED":"SEARCH_PROVIDER_UNAVAILABLE",limited?503:502,(e as {retry?:string}).retry);}
};
