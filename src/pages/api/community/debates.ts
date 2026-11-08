import type { APIRoute } from "astro";
import sharp from "sharp";
import { createSupabaseSsrClient } from "../../../lib/supabase-ssr";

export const prerender = false;
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const categories=new Set(["anime","characters","theories","comparisons","manga","general"]);
const MAX_UPLOAD_BYTES=5*1024*1024;

export const POST:APIRoute=async({request,cookies})=>{
 let uploadedPath:string|null=null;
 let supabase:ReturnType<typeof createSupabaseSsrClient>|null=null;
 try{
  const form=await request.formData();
  const title=typeof form.get("title")==="string"?(form.get("title") as string).trim():"";
  const rawBody=typeof form.get("body")==="string"?(form.get("body") as string).trim():"";
  const body=rawBody||null;
  const category=typeof form.get("category")==="string"?form.get("category") as string:"general";
  const animeTitle=typeof form.get("animeTitle")==="string"?(form.get("animeTitle") as string).trim().slice(0,120):"";
  const rawAnimeId=typeof form.get("animeId")==="string"?(form.get("animeId") as string).trim():"";
  const animeId=rawAnimeId&&/^\d+$/.test(rawAnimeId)?Number(rawAnimeId):null;
  const image=form.get("image");
  if(title.length<8||title.length>120)return json({ok:false,error:"INVALID_TITLE"},400);
  if(rawBody.length>1500)return json({ok:false,error:"INVALID_BODY"},400);
  if(!categories.has(category))return json({ok:false,error:"INVALID_CATEGORY"},400);
  if(animeId!==null&&(!Number.isSafeInteger(animeId)||animeId<=0))return json({ok:false,error:"INVALID_ANIME"},400);
  if(image!==null&&(!(image instanceof File)||image.size===0))return json({ok:false,error:"INVALID_IMAGE"},400);
  if(image instanceof File&&image.size>MAX_UPLOAD_BYTES)return json({ok:false,error:"INVALID_IMAGE"},400);

  supabase=createSupabaseSsrClient(request,cookies);
  const {data:auth,error:authError}=await supabase.auth.getUser();
  if(authError||!auth.user)return json({ok:false,error:"AUTH_REQUIRED"},401);
  const {data:profile,error:profileError}=await supabase.from("profiles").select("id,is_private").eq("id",auth.user.id).maybeSingle();
  if(profileError||!profile||profile.is_private)return json({ok:false,error:"PUBLIC_PROFILE_REQUIRED"},403);

  let imagePath:string|null=null;
  if(image instanceof File&&image.size>0){
   const input=Buffer.from(await image.arrayBuffer());
   const pipeline=sharp(input,{failOn:"error",limitInputPixels:40_000_000});
   const metadata=await pipeline.metadata();
   if(!metadata.format||!["jpeg","png","webp","avif"].includes(metadata.format))return json({ok:false,error:"INVALID_IMAGE"},400);
   const webp=await sharp(input,{failOn:"error",limitInputPixels:40_000_000})
    .rotate().resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true})
    .webp({quality:82,effort:5}).toBuffer();
   if(!webp.length||webp.length>MAX_UPLOAD_BYTES)return json({ok:false,error:"INVALID_IMAGE"},400);
   imagePath=auth.user.id+"/"+crypto.randomUUID()+".webp";
   const {error:uploadError}=await supabase.storage.from("debate-images").upload(imagePath,webp,{contentType:"image/webp",cacheControl:"31536000",upsert:false});
   if(uploadError){console.warn("Debate image upload failed:",uploadError.message);return json({ok:false,error:"IMAGE_UPLOAD_FAILED"},503);}
   uploadedPath=imagePath;
  }

  const {data,error}=await supabase.from("community_debates").insert({
   author_id:auth.user.id,title,body,category,anime_id:animeId,anime_title:animeTitle||null,
   image_path:imagePath,image_status:imagePath?"approved":"none",status:"published"
  }).select("id").single();
  if(error||!data){
   if(uploadedPath)await supabase.storage.from("debate-images").remove([uploadedPath]);
   console.warn("Community debate create failed:",error?.code);
   return json({ok:false,error:"DEBATE_CREATE_FAILED"},503);
  }
  return json({ok:true,id:data.id},201);
 }catch(error){
  if(uploadedPath&&supabase)await supabase.storage.from("debate-images").remove([uploadedPath]);
  console.error("Community debate create failed:",error);
  return json({ok:false,error:"DEBATE_CREATE_FAILED"},503);
 }
};
