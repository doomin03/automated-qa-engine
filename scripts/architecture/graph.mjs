import ts from 'typescript';
import {posix} from 'node:path';

const literal = node => node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;

/** Pure AST analysis. Process/resource URLs are deliberately not ESM edges. */
export function analyzeModule(source, path) {
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const edges = [];
  const urlNames=new Set(['URL']),workerNames=new Set(['Worker']),requireNames=new Set(['require','createRequire']);
  for(const statement of ast.statements) {
    if(!ts.isImportDeclaration(statement))continue;
    const from=literal(statement.moduleSpecifier)?.replace(/^node:/,''),bindings=statement.importClause?.namedBindings;
    if(bindings&&ts.isNamespaceImport(bindings)) {
      if(from==='module')requireNames.add(bindings.name.text+'.createRequire');
      if(from==='worker_threads')workerNames.add(bindings.name.text+'.Worker');
      if(from==='url')urlNames.add(bindings.name.text+'.URL');
    }
    if(bindings&&ts.isNamedImports(bindings))for(const binding of bindings.elements) {
      const imported=(binding.propertyName||binding.name).text,local=binding.name.text;
      if(from==='url'&&imported==='URL')urlNames.add(local);
      if(from==='worker_threads'&&imported==='Worker')workerNames.add(local);
      if(from==='module'&&imported==='createRequire')requireNames.add(local);
    }
  }
  const unsupported=[];
  if(/^(packages|runners)\//.test(path)&&!path.endsWith('.mjs'))unsupported.push('Unsupported runtime extension: '+path);
  const add = (node, kind, expression) => {
    const location = ast.getLineAndCharacterOfPosition(node.getStart(ast));
    edges.push({kind, specifier:literal(expression), expression:expression?.getText(ast), line:location.line+1, column:location.character+1});
  };
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) add(node,'esm',node.moduleSpecifier);
    if (ts.isCallExpression(node) && node.expression.kind===ts.SyntaxKind.ImportKeyword) add(node,'dynamic',node.arguments[0]);
    if(ts.isCallExpression(node)&&requireNames.has(node.expression.getText(ast)))unsupported.push('CommonJS loader is not supported in runtime ESM');
    if(ts.isNewExpression(node)&&workerNames.has(node.expression.getText(ast))) {
      const entry=node.arguments?.[0];
      if(entry&&ts.isNewExpression(entry)&&urlNames.has(entry.expression.getText(ast))) {
        if(entry.arguments?.[1]?.getText(ast)!=='import.meta.url')add(node,'worker',entry.arguments?.[0]);
      }else add(node,'worker',entry);
    }
    if (ts.isNewExpression(node) && urlNames.has(node.expression.getText(ast)) && node.arguments?.[1]?.getText(ast)==='import.meta.url') {
      const parent=node.parent;
      const isWorker=ts.isNewExpression(parent)&&workerNames.has(parent.expression.getText(ast));
      const isChild=ts.isCallExpression(parent)&&parent.expression.getText(ast)==='fork';
      const value=literal(node.arguments[0]);
      // Agent CLI URLs may be stored in a constant before spawning.
      const processEntry=value?.endsWith('/cli/aqa.mjs')||value?.endsWith('output-child.mjs');
      add(node,isWorker?'worker':isChild||processEntry?'process':'resource',node.arguments[0]);
    }
    ts.forEachChild(node,visit);
  }
  visit(ast);
  return {path,edges,parseErrors:[...ast.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')),...unsupported]};
}

const targetOf=(from,specifier)=>posix.normalize(posix.join(posix.dirname(from),specifier));
const sourceEdge=edge=>['esm','dynamic'].includes(edge.kind);

/** Pure dependency validation; files includes packaged JSON/worker entries. */
export function checkGraph(modules,{files=modules.map(m=>m.path),exceptions=[]}={}) {
  const known=new Set(files),byPath=new Map(modules.map(m=>[m.path,m])),errors=[],links=new Map();
  const used=new Set();
  for(const module of modules) {
    links.set(module.path,[]);
    for(const error of module.parseErrors||[])errors.push({file:module.path,reason:'parse',detail:error});
    for(const edge of module.edges) {
      let targets;
      if(edge.specifier===undefined) {
        const index=exceptions.findIndex(e=>e.file===module.path&&e.kind===edge.kind&&e.line===edge.line&&e.column===edge.column&&e.expression===edge.expression);
        if(index<0){errors.push({file:module.path,...edge,reason:'unapproved-computed-path'});continue;}
        const exception=exceptions[index];used.add(index);
        if(!exception.reason||!exception.targets?.length){errors.push({file:module.path,reason:'invalid-exception'});continue;}
        targets=exception.targets;
      } else if(edge.specifier.startsWith('.')) targets=[targetOf(module.path,edge.specifier)];
      else if (edge.specifier==='automated-qa-engine'||edge.specifier.startsWith('automated-qa-engine/')) {
        const exports={'automated-qa-engine':'packages/core/index.mjs','automated-qa-engine/playwright':'runners/playwright/adapter.mjs','automated-qa-engine/appium':'runners/appium/adapter.mjs'};
        if(!exports[edge.specifier]){errors.push({file:module.path,...edge,reason:'unsupported-local-specifier'});continue;}
        targets=[exports[edge.specifier]];
      } else if (/^(file:|\/|[A-Za-z]:[\\/])/.test(edge.specifier)) {
        errors.push({file:module.path,...edge,reason:'unsupported-local-specifier'});
        continue;
      } else continue;
      for(const target of targets) {
        if(!known.has(target))errors.push({file:module.path,target,reason:'missing-target'});
        if(sourceEdge(edge)&&byPath.has(target))links.get(module.path).push(target);
      }
    }
  }
  exceptions.forEach((e,index)=>{if(!used.has(index))errors.push({file:e.file,reason:'stale-exception'});});
  const active=new Set(),done=new Set();
  function cycle(file,trail=[]) {
    if(active.has(file)){errors.push({file,reason:'esm-cycle',path:[...trail,file]});return;}
    if(done.has(file))return;
    active.add(file);
    for(const target of links.get(file)||[])cycle(target,[...trail,file]);
    active.delete(file);done.add(file);
  }
  for(const file of byPath.keys())cycle(file);
  function forbidden(origin,target) {
    if(origin.startsWith('packages/core/')&&/^(packages\/(cli|agent)\/|runners\/)/.test(target))return true;
    if(/^packages\/core\/document-authoring(?:\/|\.mjs$)/.test(origin)&&/^packages\/core\/(runner\.mjs|runtime\/)/.test(target))return true;
    if(origin.startsWith('packages/core/domain/')&&target.startsWith('packages/')&&!target.startsWith('packages/core/domain/'))return true;
    if(origin.startsWith('runners/')&&(/packages\/(cli|agent)\//.test(target)||/packages\/core\/(compiler|runner|schema)\.mjs$/.test(target)||/^packages\/core\/(validation|runtime)\//.test(target)))return true;
    if(/^packages\/core\/(validation|codecs|io|media)\//.test(origin)&&target.startsWith('packages/core/runtime/'))return true;
    if(origin.startsWith('packages/cli/commands/documents')&&target.startsWith('runners/'))return true;
    return false;
  }
  for(const origin of byPath.keys()) {
    const seen=new Set();
    function walk(file,trail) {
      if(seen.has(file))return;seen.add(file);
      if(forbidden(origin,file))errors.push({file:origin,target:file,reason:'forbidden-dependency',path:trail});
      for(const target of links.get(file)||[])walk(target,[...trail,target]);
    }
    walk(origin,[origin]);
  }
  return {ok:errors.length===0,errors,moduleCount:modules.length};
}
