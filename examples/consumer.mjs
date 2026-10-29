import { loadBlueprint, executeBlueprint } from 'automated-qa-engine';
import { PlaywrightAdapter } from 'automated-qa-engine/playwright';

if(!process.argv[2]) throw new Error('Usage: node consumer.mjs BLUEPRINT_FILE');
const controller=new AbortController();
process.once('SIGINT',()=>controller.abort());
const blueprint=await loadBlueprint(process.argv[2]);
const output=await executeBlueprint(blueprint,{
  adapter:new PlaywrightAdapter(), signal:controller.signal,
  onEvent:event=>{process.stdout.write(JSON.stringify(event)+'\n');}
});
process.stderr.write(JSON.stringify({outcome:output.result.outcome,reportDir:output.reportDir})+'\n');
process.exitCode=output.result.outcome==='passed'?0:1;
