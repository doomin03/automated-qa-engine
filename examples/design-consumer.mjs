// npm install ./automated-qa-engine-0.1.0-alpha.4.tgz --ignore-scripts
// node design-consumer.mjs ./design.xml ./reference-assets
import {loadBlueprint,executeBlueprint} from 'automated-qa-engine';
import {PlaywrightAdapter} from 'automated-qa-engine/playwright';
if(!process.argv[2]||!process.argv[3])throw new Error('Usage: node design-consumer.mjs BLUEPRINT REFERENCE_ROOT');
const blueprint=await loadBlueprint(process.argv[2]);
const output=await executeBlueprint(blueprint,{adapter:new PlaywrightAdapter(),referenceRoot:process.argv[3],reportDir:'reports',onEvent:event=>{console.log(JSON.stringify(event));}});
console.error(JSON.stringify({outcome:output.result.outcome,reportDir:output.reportDir}));
