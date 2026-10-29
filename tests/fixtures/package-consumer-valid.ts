import {loadBlueprint,compileBlueprint,executeBlueprint,validateSchema,QaError,type Blueprint,type RunEvent,type RunnerAdapter} from 'automated-qa-engine';
import {PlaywrightAdapter} from 'automated-qa-engine/playwright';

const blueprint:Blueprint=await loadBlueprint('user.xml');
const adapter:RunnerAdapter=new PlaywrightAdapter();
const plan=compileBlueprint(blueprint);
plan.nodeOrder.map(id=>id.toUpperCase());
validateSchema(blueprint).flow.nodes;
const controller=new AbortController();
const output=await executeBlueprint(blueprint,{adapter,signal:controller.signal,timeoutMs:1000,headless:true,
  secretResolver:ref=>ref==='name'?'value':undefined,
  onEvent:(event:RunEvent)=>{if(event.type==='step.started')event.nodeId.toUpperCase();}
});
output.result.outcome;
new QaError('ENGINE_ERROR','message').code;
