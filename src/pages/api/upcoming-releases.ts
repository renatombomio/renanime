import type { APIRoute } from "astro";
import { getPersistentCache } from "../../lib/server/persistent-cache";
type Media = { id:number; title:{romaji:string|null;english:string|null}; coverImage:{extraLarge:string|null;large:string|null}; format:string|null; startDate:{year:number|null;month:number|null;day:number|null}; isAdult:boolean };
type ApiResponse = { data?:{Page?:{pageInfo?:{hasNextPage?:boolean};media?:Media[]}}; errors?:Array<{message?:string}> };
export type UpcomingRelease = {id:number;title:string;poster:string|null;date:string;format:"SERIES"|"MOVIE"};
const ENDPOINT="https://graphql.anilist.co", FORMATS=["TV","TV_SHORT","MOVIE","OVA","ONA"], TTL=3600;
const QUERY=`query UpcomingAnimeReleases($page:Int!,$from:FuzzyDateInt!,$to:FuzzyDateInt!,$formats:[MediaFormat!]){Page(page:$page,perPage:50){pageInfo{hasNextPage} media(type:ANIME,status:NOT_YET_RELEASED,isAdult:false,format_in:$formats,startDate_greater:$from,startDate_lesser:$to,sort:START_DATE){id title{romaji english} coverImage{extraLarge large} format startDate{year month day} isAdult}}}`;
const fuzzy=(d:Date)=>d.getUTCFullYear()*10000+(d.getUTCMonth()+1)*100+d.getUTCDate();
async function load(from:number,to:number):Promise<UpcomingRelease[]>{
 const all:Media[]=[];let next=true;
 for(let page=1;page<=3&&next;page++){
  const r=await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query:QUERY,variables:{page,from,to,formats:FORMATS}}),signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw new Error(`AniList returned HTTP ${r.status}`);
  const p=await r.json() as ApiResponse;if(p.errors?.length)throw new Error(p.errors.map(x=>x.message).filter(Boolean).join("; "));
  if(!p.data?.Page||!Array.isArray(p.data.Page.media))throw new Error("Invalid upcoming releases response");
  all.push(...p.data.Page.media);next=Boolean(p.data.Page.pageInfo?.hasNextPage);
 }
 const seen=new Set<number>();
 return all.filter(x=>!x.isAdult&&x.format&&FORMATS.includes(x.format)).map((x):UpcomingRelease|null=>{
  const {year,month,day}=x.startDate;if(!year||!month||!day)return null;
  const d=new Date(Date.UTC(year,month-1,day));if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)return null;
  return {id:x.id,title:x.title.romaji||x.title.english||"Untitled",poster:x.coverImage.extraLarge||x.coverImage.large||null,date:`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`,format:x.format==="MOVIE"?"MOVIE":"SERIES"};
 }).filter((x):x is UpcomingRelease=>{if(!x||seen.has(x.id))return false;seen.add(x.id);return true;}).sort((a,b)=>a.date.localeCompare(b.date));
}
export async function getUpcomingReleases(now=new Date()):Promise<UpcomingRelease[]>{
 const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())),end=new Date(start);end.setUTCDate(end.getUTCDate()+90);
 const from=fuzzy(start),to=fuzzy(end);
 const result=await getPersistentCache<UpcomingRelease[]>("upcoming-releases",{from,to,formats:FORMATS},TTL,()=>load(from,to));
 return result.value;
}
export const GET:APIRoute=async()=>{
 try{const items=await getUpcomingReleases();return Response.json({success:true,items},{headers:{"Cache-Control":"no-store"}});}
 catch(error){console.error("[upcoming-releases] AniList request failed:",error);return Response.json({success:false,error:"UPCOMING_RELEASES_UNAVAILABLE"},{status:502,headers:{"Cache-Control":"no-store"}});}
};
