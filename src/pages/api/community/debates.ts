import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../lib/supabase-ssr";
export const prerender = false;
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const categories=new Set(["anime","characters","theories","comparisons","manga","general"]);
const imageTypes:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/avif":"avif"};
export const POST:APIRoute=async({request,cookies})=>{
 try{
  const form=await request.formData();
  const title=typeof form.get("title")==="string"?(form.get("title") as string).trim():"";
  const content=typeof form.get("body")==="string"?(form.get("body") as string).trim():"";
  const category=typeof form.get("category")==="string"?form.get("category") as string:"general";
  const image=form.get("image");
  if(title.length<8||title.length>120)return json({ok:false,error:"INVALID_TITLE"},400);
  if(content.length<20||content.length>3000)return json({ok:false,error:"INVALID_BODY"},400);
  if(!categories.has(category))return json({ok:false,error:"INVALID_CATEGORY"},400);
  if(image!==null && (!(image instanceof File)||image.size===0))return json({ok:false,error:"INVALID_IMAGE"},400);
  if(image instanceof File && (!imageTypes[image.type]||image.size>5*1024*1024))return json({ok:false,error:"INVALID_IMAGE"},400);
  const supabase=createSupabaseSsrClient(request,cookies);
  const {data:auth,error:authError}=await supabase.auth.getUser();
  if(authError||!auth.user)return json({ok:false,error:"AUTH_REQUIRED"},401);
  const {data:profile,error:profileError}=await supabase.from("profiles").select("id,is_private").eq("id",auth.user.id).maybeSingle();
  if(profileError||!profile||profile.is_private)return json({ok:false,error:"PUBLIC_PROFILE_REQUIRED"},403);
  let imagePath:string|null=null;
  if(image instanceof File && image.size>0){
    const extension=imageTypes[image.type];
    imagePath=auth.user.id+"/"+crypto.randomUUID()+"."+extension;
    const {error:uploadError}=await supabase.storage.from("debate-quarantine").upload(imagePath,image,{contentType:image.type,cacheControl:"3600",upsert:false});
    if(uploadError){console.warn("Debate image upload failed:",uploadError.message);return json({ok:false,error:"IMAGE_UPLOAD_FAILED"},503)}
  }
  const {data,error}=await supabase.from("community_debates").insert({author_id:auth.user.id,title,body:content,category,image_path:imagePath,image_status:imagePath?"pending":"none",status:"published"}).select("id").single();
  if(error||!data){
    if(imagePath)await supabase.storage.from("debate-quarantine").remove([imagePath]);
    console.warn("Community debate create failed:",error?.code);
    return json({ok:false,error:"DEBATE_CREATE_FAILED"},503);
  }
  return json({ok:true,id:data.id,imagePending:Boolean(imagePath)},201);
 }catch(error){console.error("Community debate create failed:",error);return json({ok:false,error:"DEBATE_CREATE_FAILED"},503)}
};
