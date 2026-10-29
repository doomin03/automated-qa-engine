import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
export async function startDemoServer(port=0) {
  const html=await readFile(new URL('./demo.html',import.meta.url));
  const server=createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {origin:'http://127.0.0.1:'+server.address().port,close:()=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const server=await startDemoServer(Number(process.env.PORT || 4317));
  console.log(server.origin);
  process.once('SIGINT',async()=>{await server.close();process.exit(0);});
}

