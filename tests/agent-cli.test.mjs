import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
test('actual Agent CLI reports exhausted 20000-record journal with exit 3 before claim',async t=>{
 const root=await mkdtemp(join(tmpdir(),'aqa-agent-quota-')),agentId='quota-agent';let lastHash='0'.repeat(64),journal='',claims=0;
 for(let sequence=1;sequence<=20000;sequence++){const base={version:1,sequence,previousHash:lastHash,agentId,operation:{kind:'set',key:'retired-instance:'+sequence,value:sequence}};lastHash=createHash('sha256').update(JSON.stringify(base)).digest('hex');journal+=JSON.stringify({...base,sha256:lastHash})+'\n';}
 await writeFile(join(root,'journal.jsonl'),journal);
 const server=createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;const body=JSON.parse(raw);res.setHeader('content-type','application/json');if(req.url.endsWith('/claims')){claims++;res.statusCode=204;res.end();return;}res.end(JSON.stringify({agentId,instanceId:body.instanceId,instanceState:'active',decisions:[],hasMore:false,nextCursor:null}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());
 const file=join(root,'config.json');await writeFile(file,JSON.stringify({schemaVersion:'qa.agentConfig/v1',agentId,serverUrl:'http://127.0.0.1:'+server.address().port,tokenEnv:'AQA_TEST_TOKEN',allowInsecureLocal:true,stateDir:root,projectIds:[],resources:{},credentials:{}}));
 const child=spawn(process.execPath,[resolve('packages/cli/aqa.mjs'),'agent','--config',file,'--once'],{windowsHide:true,env:{...process.env,AQA_TEST_TOKEN:'fixture-token'},stdio:['ignore','pipe','pipe']});let stderr='';child.stdout.resume();child.stderr.on('data',b=>stderr+=b);const code=await new Promise(r=>child.on('close',r));
 assert.equal(code,3);assert.equal(JSON.parse(stderr).error.code,'AGENT_STATE_FULL');assert(!stderr.includes('fixture-token'));assert.equal(claims,0);
});
