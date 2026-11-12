import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { jikanProvider } from "../../lib/api/jikan";

const ENDPOINT = "https://graphql.anilist.co";
const PAGE_SIZE = 24;
const MAX_PAGE = 10;
const SEARCH_TTL = 12 * 60 * 60;
const FILTER_TTL = 6 * 60 * 60;
const GENRES = new Set(["Action","Adventure","Comedy","Drama","Fantasy","Horror","Mahou Shoujo","Mecha","Music","Mystery","Psychological","Romance","Sci-Fi","Slice of Life","Sports","Supernatural","Thriller"]);
const FIELDS = "id title { romaji english } startDate { year month day } coverImage { extraLarge large } format genres seasonYear status averageScore";
type Media = { id:number; title?:{romaji?:string|null;english?:string|null}; startDate?:{year?:number|null;month?:number|null;day?:number|null}|null; coverImage?:{extraLarge?:string|null;large?:string|null}; format?:string|null; genres?:string[]; seasonYear?:number|null; status?:string|null; averageScore?:number|null };
type Data = {items:Media[];total:number;hasNextPage:boolean;source:"anilist"|"jikan"};
type CacheState = "HIT"|"MISS"|"BYPASS";
const pending = new Map<string,Promise<{data:Data;cache:CacheState}>>();

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const cacheToken = import.meta.env.ANIME_SEARCH_CACHE_TOKEN;
const cacheClient = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
      global: { headers: { "x-cache-token": cacheToken ?? "", "X-Client-Info": "renanime-search-cache" } }
    })
  : null;

function fail(error:string,status:number,retry?:string) {
  const headers = new Headers({"Cache-Control":"no-store","Vercel-CDN-Cache-Control":"no-store"});
  if(retry) headers.set("Retry-After",retry);
  return Response.json({success:false,error},{status,headers});
}
async function digest(value:string):Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
}
async function readCache(key:string):Promise<Data|null> {
  if(!cacheClient||!cacheToken) return null;
  const {data,error}=await cacheClient.rpc("anime_search_cache_get",{p_cache_key:key});
  if(error) { console.warn("[anime-search] cache read failed:",error.message); return null; }
  return data && typeof data==="object" && Array.isArray(data.items) ? data as Data : null;
}
async function writeCache(key:string,type:"search"|"filters",filters:Record<string,unknown>,data:Data,ttl:number) {
  if(!cacheClient||!cacheToken) return;
  const {error}=await cacheClient.rpc("anime_search_cache_put",{
    p_cache_key:key,p_query_type:type,p_filters:filters,p_payload:data,p_ttl_seconds:data.source==="jikan"?Math.min(ttl,1800):ttl
  });
  if(error) console.warn("[anime-search] cache write failed:",error.message);
}
async function claimCacheLock(key:string,owner:string):Promise<boolean> {
  if(!cacheClient||!cacheToken) return false;
  const {data,error}=await cacheClient.rpc("anime_search_cache_claim",{p_cache_key:key,p_owner:owner});
  if(error) { console.warn("[anime-search] cache lock failed:",error.message); return false; }
  return data===true;
}
async function releaseCacheLock(key:string,owner:string) {
  if(!cacheClient||!cacheToken) return;
  const {error}=await cacheClient.rpc("anime_search_cache_release",{p_cache_key:key,p_owner:owner});
  if(error) console.warn("[anime-search] cache lock release failed:",error.message);
}
async function anilist(query:string,variables:Record<string,unknown>) {
  const r=await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(10000)});
  if(r.status===429) throw Object.assign(new Error("RATE_LIMIT"),{status:429,retry:r.headers.get("Retry-After")||"30"});
  if(!r.ok) throw new Error("ANILIST_HTTP_"+r.status);
  const p=await r.json();
  if(p.errors?.length||!p.data?.Page||!Array.isArray(p.data.Page.media)) throw new Error("ANILIST_INVALID_RESPONSE");
  return p.data.Page;
}
async function searchAnime(q:string,page:number):Promise<Data> {
  const query="query SearchAnime($search:String!,$page:Int!,$perPage:Int!){Page(page:$page,perPage:$perPage){pageInfo{total hasNextPage} media(search:$search,type:ANIME,sort:SEARCH_MATCH,isAdult:false){"+FIELDS+"}}}";
  try {
    const p=await anilist(query,{search:q,page,perPage:PAGE_SIZE});
    return {items:p.media,total:p.pageInfo?.total??0,hasNextPage:Boolean(p.pageInfo?.hasNextPage),source:"anilist"};
  } catch(e) {
    if((e as {status?:number}).status===429) throw e;
    const entries=await jikanProvider.search({query:q,page,perPage:PAGE_SIZE});
    const items:Media[]=entries.map(x=>({id:x.external.mal??Number(x.id.replace("mal-","")),title:{romaji:x.metadata.title,english:x.metadata.title},startDate:x.metadata.year?{year:x.metadata.year}:null,coverImage:x.metadata.images.cover?{extraLarge:x.metadata.images.cover,large:x.metadata.images.cover}:undefined,format:x.metadata.format}));
    return {items,total:items.length,hasNextPage:false,source:"jikan"};
  }
}
async function filterAnime(genres:string[],year:string,status:string,page:number):Promise<Data> {
  const y=year&&year!=="before-2016"?Number(year):null;
  const after=y?y*10000:null,before=y?(y+1)*10000:year==="before-2016"?20160000:null;
  const query="query FilterAnime($genres:[String],$status:MediaStatus,$after:FuzzyDateInt,$before:FuzzyDateInt,$page:Int!,$perPage:Int!){Page(page:$page,perPage:$perPage){pageInfo{total hasNextPage} media(type:ANIME,genre_in:$genres,status:$status,startDate_greater:$after,startDate_lesser:$before,sort:POPULARITY_DESC,isAdult:false){"+FIELDS+"}}}";
  const p=await anilist(query,{genres:genres.length?genres:null,status:status||null,after,before,page,perPage:PAGE_SIZE});
  return {items:p.media,total:p.pageInfo?.total??0,hasNextPage:Boolean(p.pageInfo?.hasNextPage),source:"anilist"};
}
async function loadCached(key:string,type:"search"|"filters",filters:Record<string,unknown>,ttl:number,load:()=>Promise<Data>):Promise<{data:Data;cache:CacheState}> {
  if(!cacheClient||!cacheToken) return {data:await load(),cache:"BYPASS"};
  const hit=await readCache(key);
  if(hit) return {data:hit,cache:"HIT"};

  const owner=crypto.randomUUID();
  let ownsLock=await claimCacheLock(key,owner);
  if(!ownsLock) {
    // Another server instance is filling this exact query. Wait for its result.
    for(let attempt=0;attempt<10;attempt++) {
      await new Promise(resolve=>setTimeout(resolve,400));
      const shared=await readCache(key);
      if(shared) return {data:shared,cache:"HIT"};
      if(attempt===4) ownsLock=await claimCacheLock(key,owner);
      if(ownsLock) break;
    }
  }

  try {
    const secondHit=await readCache(key);
    if(secondHit) return {data:secondHit,cache:"HIT"};
    const data=await load();
    await writeCache(key,type,filters,data,ttl);
    return {data,cache:"MISS"};
  } finally {
    if(ownsLock) await releaseCacheLock(key,owner);
  }
}

export const GET:APIRoute=async({request})=>{
  const params=new URL(request.url).searchParams;
  const q=(params.get("q")||"").trim().replace(/\s+/g," ");
  const page=Number(params.get("page")||"1");
  const genres=[...new Set(params.getAll("genre").map(x=>x.trim()))].sort();
  const year=params.get("year")||"";
  const status=params.get("status")||"";
  const now=new Date().getFullYear();

  if(!Number.isInteger(page)||page<1||page>MAX_PAGE) return fail("INVALID_PAGE",400);
  if(q.length>80||(q&&q.length<2)) return fail("INVALID_QUERY",400);
  if(genres.some(x=>!GENRES.has(x))) return fail("INVALID_GENRE",400);
  if(year&&year!=="before-2016"&&(!/^\d{4}$/.test(year)||Number(year)<now-9||Number(year)>now)) return fail("INVALID_YEAR",400);
  if(status&&!["FINISHED","RELEASING"].includes(status)) return fail("INVALID_STATUS",400);
  if(q&&(genres.length||year||status)) return fail("SEARCH_AND_FILTERS_ARE_MUTUALLY_EXCLUSIVE",400);

  const isSearch=q.length>=2;
  if(!isSearch&&!genres.length&&!year&&!status) return fail("MISSING_SEARCH_OR_FILTER",400);
  const normalizedQuery=q.toLocaleLowerCase("en");
  const filterState=isSearch?{query:normalizedQuery,page}:{genres,year,status,page};
  const rawKey=(isSearch?"search:":"filters:")+JSON.stringify(filterState);
  const key=await digest(rawKey);
  const localKey=key;

  try {
    let job=pending.get(localKey);
    if(!job) {
      job=loadCached(
        key,isSearch?"search":"filters",filterState,isSearch?SEARCH_TTL:FILTER_TTL,
        ()=>isSearch?searchAnime(q,page):filterAnime(genres,year,status,page)
      );
      pending.set(localKey,job);
    }
    let result:{data:Data;cache:CacheState};
    try { result=await job; } finally { if(pending.get(localKey)===job) pending.delete(localKey); }
    return Response.json({success:true,...result.data},{headers:{
      "Cache-Control":"no-store",
      "Vercel-CDN-Cache-Control":"no-store",
      "X-Renanime-Search-Source":result.data.source,
      "X-Renanime-Cache":result.cache
    }});
  } catch(e) {
    const limited=(e as {status?:number}).status===429;
    return fail(limited?"SEARCH_PROVIDER_RATE_LIMITED":"SEARCH_PROVIDER_UNAVAILABLE",limited?503:502,(e as {retry?:string}).retry);
  }
};
