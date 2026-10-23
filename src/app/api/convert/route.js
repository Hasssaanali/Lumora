import sharp from "sharp";
export const runtime = "nodejs";
const allowed = new Set(["png", "jpeg", "webp", "avif"]);
export async function POST(request) {
  try {
    const data = await request.formData();
    const image = data.get("image");
    const format = String(data.get("format") || "webp").toLowerCase();
    const q0 = Number(data.get("quality") || 85);
    const quality = Math.min(100, Math.max(10, Number.isFinite(q0) ? q0 : 85));
    if (!(image instanceof File) || !image.type.startsWith("image/")) return Response.json({error:"Please provide a valid image file."},{status:400});
    if (image.size > 20*1024*1024) return Response.json({error:"Maximum file size is 20 MB."},{status:413});
    if (!allowed.has(format)) return Response.json({error:"Unsupported output format."},{status:400});
    let pipeline = sharp(Buffer.from(await image.arrayBuffer()), {limitInputPixels:40_000_000}).rotate();
    if(format==="png") pipeline=pipeline.png({compressionLevel:9});
    if(format==="jpeg") pipeline=pipeline.flatten({background:"#ffffff"}).jpeg({quality,mozjpeg:true});
    if(format==="webp") pipeline=pipeline.webp({quality});
    if(format==="avif") pipeline=pipeline.avif({quality});
    const output=await pipeline.toBuffer();
    const mime={png:"image/png",jpeg:"image/jpeg",webp:"image/webp",avif:"image/avif"}[format];
    return new Response(output,{headers:{"Content-Type":mime,"Content-Disposition":`attachment; filename="converted.${format==="jpeg"?"jpg":format}"`,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  } catch(e) { console.error("Conversion error:",e); return Response.json({error:"Could not process this image. Try a supported image file."},{status:400}); }
}
