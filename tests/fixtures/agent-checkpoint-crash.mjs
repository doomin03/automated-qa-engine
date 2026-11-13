import {openAgentStore} from '../../packages/agent/store.mjs';
const [root,phase]=process.argv.slice(2);
const store=await openAgentStore(root,{agentId:'checkpoint-agent',checkpointHook:async point=>{if(point===phase)process.exit(77);}});
await store.compactEmptyClaims({force:true});await store.close();
