import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {compileBlueprint,ACTIONS} from '../../packages/core/compiler.mjs';
const release=JSON.parse(await readFile(new URL('../../contracts/release.json',import.meta.url),'utf8'));
export const blueprint=JSON.parse(await readFile(new URL('../../examples/login.qa.json',import.meta.url),'utf8'));
export function agentFixture(){
 const agentId='test-agent',instanceId=randomUUID(),origin=blueprint.target.allowedOrigins[0],b=structuredClone(blueprint),expected={instanceId,engineVersion:release.engineVersion,contractVersion:release.contractVersion,contractSha256:'a'.repeat(64)};
 const config={schemaVersion:'qa.agentConfig/v1',agentId,serverUrl:'http://127.0.0.1:1',tokenEnv:'AGENT_TOKEN',stateDir:'.state',allowInsecureLocal:true,projectIds:['project'],resources:{'web-slot':{platform:'web',allowedOrigins:[origin],nativeApps:[],secretRefs:[],actions:ACTIONS,allowProduction:false}},credentials:{},maxRunMs:10000};
 const lease={agentId,instanceId,leaseId:randomUUID(),executionId:randomUUID(),projectId:'project',jobAttempt:1,fence:1,resourceKey:'web-slot',cases:[{caseId:'case1',blueprintJson:JSON.stringify(b),blueprintSnapshotHash:compileBlueprint(b).blueprintSnapshotHash,resources:[],publishedVersion:null}],engineVersion:expected.engineVersion,engineContractVersion:expected.contractVersion,engineContractSha256:expected.contractSha256,protocolVersion:'0.1.0-draft.1',state:'active',validForMs:30000,heartbeatIntervalMs:5000,requestTimeoutMs:5000,safetyMarginMs:5000,cancelRequested:false,acceptedThrough:0,executionPolicy:{resourceKey:'web-slot',platform:'web',allowedOrigins:[origin],nativeApps:[],secretRefs:[],allowProduction:false},suitePolicy:{stopOnFailure:true,publishedVersionId:null,publishedSha256:null}};
 return {agentId,instanceId,origin,blueprint:b,config,lease,expected};
}
