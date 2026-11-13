import {executeBlueprint} from 'automated-qa-engine';
import {PlaywrightAdapter} from 'automated-qa-engine/playwright';
executeBlueprint({}, {adapter:new PlaywrightAdapter(),headless:'yes'});
executeBlueprint({}, {adapter:new PlaywrightAdapter(),onEvent:()=>123});
executeBlueprint({}, {adapter:{}});
import {createTemplate,composeBlueprint} from 'automated-qa-engine';
createTemplate({templateId:'unrecognized',version:'1',sha256:'a',bindings:{}});
composeBlueprint({schemaVersion:'qa.composition/v1',assets:[{id:'a',format:'yaml',source:'x',sha256:'x'}],instances:[],links:[]});
