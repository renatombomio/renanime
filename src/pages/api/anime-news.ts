import type { APIRoute } from "astro";
import { getAnimeNews } from "../../lib/anime-news";
export const GET:APIRoute=async()=>{
 try{const items=await getAnimeNews();return Response.json({success:true,items},{headers:{"Cache-Control":"no-store"}});}
 catch(error){console.error("[anime-news] RSS feeds unavailable:",error);return Response.json({success:false,error:"ANIME_NEWS_UNAVAILABLE"},{status:502,headers:{"Cache-Control":"no-store"}});}
};
