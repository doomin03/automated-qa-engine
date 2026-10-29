import { createHash } from 'node:crypto';
import { validateSchema } from './schema.mjs';
import { QaError, ensure } from './errors.mjs';
export const ENGINE_VERSION = '0.1.0-alpha.2';
export const ACTIONS = ['launch','tap','input','clear','waitFor','assertVisible','assertText','assertValue','screenshot'];
export function canonicalJson(value) {
  if(Array.isArray(value)) return '['+value.map(canonicalJson).join(',')+']';
  if(value && typeof value==='object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJson(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
export const hash = value => 'sha256:' + createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex');
const own = (o,k) => Object.hasOwn(o || {},k);
function freeze(o) { if(o && typeof o === 'object') { Object.values(o).forEach(freeze); Object.freeze(o); } return o; }
export function compileBlueprint(document) {
  for(const part of [document,document?.flow,document?.selectors,document?.target,document?.testCase].filter(Boolean)) validateSchema(part);
  ensure(document.schemaVersion === 'qa.blueprint/v1','INVALID_DOCUMENT','A blueprint is required');
  const b = structuredClone(document), {flow,selectors,target} = b;
  ensure(target.platform === 'web','UNSUPPORTED_CAPABILITY','Only web is implemented');
  if(b.testCase) ensure(b.testCase.platforms.includes(target.platform),'UNSUPPORTED_CAPABILITY','TC does not support target');
  const origins = target.allowedOrigins.map(origin=>{
    let url; try { url=new URL(origin); } catch { throw new QaError('INVALID_TARGET','Invalid allowed origin'); }
    ensure(['http:','https:'].includes(url.protocol) && !url.username && !url.password && url.origin===origin, 'INVALID_TARGET','allowedOrigins must contain exact HTTP(S) origins');
    return url.origin;
  });
  for(const urlText of Object.values(target.launchTargets)) {
    let url; try { url = new URL(urlText); } catch { throw new QaError('INVALID_TARGET','Invalid launch URL'); }
    ensure(origins.includes(url.origin) && !url.username && !url.password, 'POLICY_DENIED','Launch target is outside allowed origins');
  }
  const nodes = new Map();
  for(const node of flow.nodes) {
    ensure(!nodes.has(node.id),'INVALID_FLOW','Duplicate node: '+node.id); nodes.set(node.id,node);
    if(node.action) ensure(ACTIONS.includes(node.action),'UNSUPPORTED_CAPABILITY','Unsupported action');
    if(node.params?.selector) ensure(own(selectors.selectors,node.params.selector),'INVALID_FLOW','Missing selector: '+node.params.selector);
    if(node.action==='launch') ensure(own(target.launchTargets,node.params.target),'INVALID_FLOW','Missing launch target');
    if(node.params?.valueRef) ensure(own(flow.variables,node.params.valueRef),'INVALID_FLOW','Missing variable reference');
    if(node.type==='branch') {
      ensure(own(flow.variables,node.condition.variable),'INVALID_FLOW','Missing branch variable');
      ensure(flow.variables[node.condition.variable].from==='literal','INVALID_FLOW','Branch conditions cannot reveal secrets');
    }
    if((node.retry?.maxRetries || 0)>0 && ['launch','tap','input','clear'].includes(node.action)) {
      ensure(node.retry.allowSideEffects === true,'POLICY_DENIED','Side-effect retry requires allowSideEffects');
    }
  }
  ensure(nodes.get(flow.entryNode)?.type==='start','INVALID_FLOW','entryNode must be a start');
  ensure(flow.nodes.filter(n=>n.type==='start').length===1,'INVALID_FLOW','Exactly one start is required');
  const outgoing = new Map(flow.nodes.map(n=>[n.id,[]]));
  const edgeKeys = new Set();
  for(const edge of flow.edges) {
    ensure(nodes.has(edge.from)&&nodes.has(edge.to),'INVALID_FLOW','Dangling edge');
    ensure(edge.to!==flow.entryNode,'INVALID_FLOW','An edge cannot enter start');
    const key = edge.from+'|'+edge.to+'|'+(edge.label || '');
    ensure(!edgeKeys.has(key),'INVALID_FLOW','Duplicate edge'); edgeKeys.add(key);
    outgoing.get(edge.from).push(edge);
  }
  for(const node of flow.nodes) {
    const edges = outgoing.get(node.id);
    if(node.type==='end') ensure(edges.length===0,'INVALID_FLOW','End cannot have outgoing edges');
    else if(node.type==='branch') ensure(edges.length===2 && new Set(edges.map(e=>e.label)).size===2 && edges.every(e=>['true','false'].includes(e.label)),'INVALID_FLOW','Branch requires true and false edges');
    else ensure(edges.length===1 && !edges[0].label,'INVALID_FLOW','Node requires one unlabeled edge');
  }
  const active=new Set(),visited=new Set(),order=[];
  const visit=id=>{
    ensure(!active.has(id),'INVALID_FLOW','Cycle detected');
    if(visited.has(id)) return;
    active.add(id); for(const edge of outgoing.get(id)) visit(edge.to);
    active.delete(id); visited.add(id); order.unshift(id);
  };
  visit(flow.entryNode);
  ensure(visited.size===nodes.size,'INVALID_FLOW','Unreachable nodes');
  const secretRefs = [...new Set(Object.values(flow.variables || {}).filter(v=>v.from==='secret').map(v=>v.ref))];
  return freeze({schemaVersion:'qa.plan/v1',engineVersion:ENGINE_VERSION,blueprint:b,entryNode:flow.entryNode,nodeOrder:order,requiredActions:[...new Set(flow.nodes.flatMap(n=>n.action?[n.action]:[]))],secretRefs,flowSnapshotHash:hash(flow),blueprintSnapshotHash:hash(b)});
}
export function resolveVariables(plan, secretResolver=()=>undefined) {
  const values=Object.create(null);
  for(const [name,variable] of Object.entries(plan.blueprint.flow.variables || {})) {
    const value = variable.from==='literal' ? variable.value : secretResolver(variable.ref);
    ensure(variable.from==='literal' || (value !== undefined && value !== null),'SECRET_NOT_FOUND','Required secret is unavailable');
    values[name]=value;
  }
  return values;
}

