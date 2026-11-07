import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../lib/supabase-ssr";
export const prerender = false;
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const categories=new Set(["anime","characters","theories","comparisons","manga","general"]);
export const POST:APIRoute=async({request,cookies})=>{
 let body:{title?:unknown;body?:unknown;category?:unknown};
 try{body=await request.json()}catch{return json({ok:false,error:"INVALID_REQUEST"},400)}
 const title=typeof body.title==="string"?body.title.trim():"";
 const content=typeof body.body==="string"?body.body.trim():"";
 const category=typeof body.category==="string"?body.category:"general";
 if(title.length<8||title.length>120)return json({ok:false,error:"INVALID_TITLE"},400);
 if(content.length<20||content.length>3000)return json({ok:false,error:"INVALID_BODY"},400);
 if(!categories.has(category))return json({ok:false,error:"INVALID_CATEGORY"},400);
 try{
  const supabase=createSupabaseSsrClient(request,cookies);
  const {data:auth,error:authError}=await supabase.auth.getUser();
  if(authError||!auth.user)return json({ok:false,error:"AUTH_REQUIRED"},401);
  const {data:profile,error:profileError}=await supabase.from("profiles").select("id,is_private").eq("id",auth.user.id).maybeSingle();
  if(profileError||!profile||profile.is_private)return json({ok:false,error:"PUBLIC_PROFILE_REQUIRED"},403);
  const {data,error}=await supabase.from("community_debates").insert({author_id:auth.user.id,title,body:content,category,image_path:null,image_status:"none",status:"published"}).select("id").single();
  if(error||!data){console.warn("Community debate create failed:",error?.code);return json({ok:false,error:"DEBATE_CREATE_FAILED"},503)}
  return json({ok:true,id:data.id},201);
 }catch(error){console.error("Community debate create failed:",error);return json({ok:false,error:"DEBATE_CREATE_FAILED"},503)}
};
