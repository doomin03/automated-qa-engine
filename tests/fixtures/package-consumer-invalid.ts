import {executeBlueprint} from 'automated-qa-engine';
import {PlaywrightAdapter} from 'automated-qa-engine/playwright';
executeBlueprint({}, {adapter:new PlaywrightAdapter(),headless:'yes'});
executeBlueprint({}, {adapter:new PlaywrightAdapter(),onEvent:()=>123});
executeBlueprint({}, {adapter:{}});
