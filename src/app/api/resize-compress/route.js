import sharp from "sharp";
export const runtime = "nodejs";
export async function POST(request) {
  try {
    const data=await request.formData();
    const image=data.get("image");
    const widthRaw=Number(data.get("width")||0);
    const heightRaw=Number(data.get("height")||0);
    const qualityRaw=Number(data.get("quality")||80);
    const format=String(data.get("format")||"webp").toLowerCase();
    const width=Number.isFinite(widthRaw)?Math.min(8000,Math.max(0,Math.floor(widthRaw))):0;
    const height=Number.isFinite(heightRaw)?Math.min(8000,Math.max(0,Math.floor(heightRaw))):0;
    const quality=Math.min(100,Math.max(10,Number.isFinite(qualityRaw)?qualityRaw:80));
    if(!(image instanceof File)||!image.type.startsWith("image/")) return Response.json({error:"Please provide a valid image."},{status:400});
    if(image.size>20*1024*1024) return Response.json({error:"Maximum file size is 20 MB."},{status:413});
    if(!["jpeg","png","webp","avif"].includes(format)) return Response.json({error:"Unsupported output format."},{status:400});
    if(!width&&!height) return Response.json({error:"Enter a width or height."},{status:400});
    let p=sharp(Buffer.from(await image.arrayBuffer()),{limitInputPixels:40_000_000}).rotate();
    p=p.resize({width:width||undefined,height:height||undefined,fit:"inside",withoutEnlargement:true});
    if(format==="jpeg") p=p.flatten({background:"#fff"}).jpeg({quality,mozjpeg:true});
    if(format==="png") p=p.png({compressionLevel:9});
    if(format==="webp") p=p.webp({quality});
    if(format==="avif") p=p.avif({quality});
    const output=await p.toBuffer();
    const mime={jpeg:"image/jpeg",png:"image/png",webp:"image/webp",avif:"image/avif"}[format];
    return new Response(output,{headers:{"Content-Type":mime,"Content-Disposition":`attachment; filename="resized.${format==="jpeg"?"jpg":format}"`,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  } catch(e) { console.error("Resize/compress error:",e); return Response.json({error:"Could not resize this image."},{status:400}); }
}
