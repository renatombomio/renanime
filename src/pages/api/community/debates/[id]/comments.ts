import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../../../lib/supabase-ssr";
export const prerender=false;
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
export const POST:APIRoute=async({request,cookies,params})=>{try{
 const id=params.id;if(!id)return json({ok:false,error:"INVALID_DEBATE"},400);
 const payload=await request.json();const content=typeof payload?.content==="string"?payload.content.trim():"";
 if(!content||content.length>1500)return json({ok:false,error:"INVALID_CONTENT"},400);
 const supabase=createSupabaseSsrClient(request,cookies);
 const {data:auth,error:authError}=await supabase.auth.getUser();if(authError||!auth.user)return json({ok:false,error:"AUTH_REQUIRED"},401);
 const {data:profile,error:profileError}=await supabase.from("profiles").select("id,is_private").eq("id",auth.user.id).maybeSingle();if(profileError||!profile||profile.is_private)return json({ok:false,error:"PUBLIC_PROFILE_REQUIRED"},403);
 const {data:debate,error:debateError}=await supabase.from("community_debates").select("id").eq("id",id).eq("status","published").maybeSingle();if(debateError||!debate)return json({ok:false,error:"DEBATE_NOT_FOUND"},404);
 const {error}=await supabase.from("community_debate_comments").insert({debate_id:id,author_id:auth.user.id,content,status:"visible"});if(error)return json({ok:false,error:"REPLY_CREATE_FAILED"},503);
 return json({ok:true},201);
 }catch{return json({ok:false,error:"REPLY_CREATE_FAILED"},503);}};
