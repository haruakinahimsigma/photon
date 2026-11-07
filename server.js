import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const types = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg", ".webp":"image/webp" };

http.createServer(async (req,res)=>{
  if(!["GET","HEAD"].includes(req.method)){res.writeHead(405,{"Allow":"GET, HEAD"});return res.end();}
  try{
    const url=new URL(req.url,"http://localhost");
    let pathname=decodeURIComponent(url.pathname);
    let file=path.resolve(root,"."+pathname);
    if(!file.startsWith(root+path.sep)&&file!==root)throw new Error("Invalid path");
    if((await stat(file).catch(()=>null))?.isDirectory())file=path.join(file,"index.html");
    const data=await readFile(file);
    res.writeHead(200,{"Content-Type":types[path.extname(file)]||"application/octet-stream","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});
    if(req.method==="HEAD")return res.end();
    res.end(data);
  }catch{
    res.writeHead(404,{"Content-Type":"text/plain; charset=utf-8"});res.end("404 — Not found");
  }
}).listen(port,"0.0.0.0",()=>console.log("LIMINAL listening on "+port));
