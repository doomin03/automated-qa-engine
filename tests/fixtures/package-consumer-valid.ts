import {loadBlueprint,compileBlueprint,executeBlueprint,validateSchema,QaError,type Blueprint,type RunEvent,type RunnerAdapter} from 'automated-qa-engine';
import {PlaywrightAdapter} from 'automated-qa-engine/playwright';
import {AppiumAdapter} from 'automated-qa-engine/appium';
import {expandPreset,listPresets,blueprintXml,type CheckObservation} from 'automated-qa-engine';
import {expandAuthoring,parseAuthoringSource,authoringXml,type AuthoringDocument,type AuthoringSourceMap} from 'automated-qa-engine';
const authoring:AuthoringDocument=parseAuthoringSource('{}','json');
const expansion=expandAuthoring(authoring);const sourceMap:AuthoringSourceMap=expansion.sourceMap;sourceMap.nodes.map(n=>n.iteration);
authoringXml(authoring);
const native:RunnerAdapter=new AppiumAdapter({endpoint:'http://127.0.0.1:4723',capabilities:{'appium:automationName':'UiAutomator2','appium:udid':'device','appium:deviceName':'device'}});
const observation:CheckObservation={kind:'ux',verdict:'passed',reason:'MATCH',images:[{role:'actual',bytes:new Uint8Array()}]};
const presetBlueprint=expandPreset(listPresets()[0].id,'1.0.0',{});blueprintXml(presetBlueprint);

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
import {listTemplates, createTemplate, composeBlueprint, type CompositionInput, type AuthoredBlueprint} from 'automated-qa-engine';
const template = listTemplates().templates[0];
const authored:AuthoredBlueprint = createTemplate({templateId:'empty',version:template.version,sha256:template.sha256,bindings:{id:'example',target:blueprint.target}});
compileBlueprint(authored.blueprint);
const composition:CompositionInput = {schemaVersion:'qa.composition/v1',assets:[],instances:[],links:[]};
composeBlueprint(composition).sourceMap?.nodes['example'].sourceNodeId.toUpperCase();
