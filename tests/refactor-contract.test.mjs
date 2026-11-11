import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileBlueprint} from '../packages/core/compiler.mjs';
import {freezeOwned,frozenSnapshot} from '../packages/core/domain/immutable.mjs';
import {renderTypes} from '../scripts/generation/types.mjs';
import {renderContract} from '../scripts/generation/contract.mjs';
import {schema} from '../packages/core/schema.mjs';
import {listPresets} from '../packages/core/presets.mjs';
test('compiler preserves independent ownership and canonical order across source key order',async()=>{
  const source=JSON.parse(await readFile(new URL('../examples/login.qa.json',import.meta.url),'utf8'));
  const a=compileBlueprint(source),b=compileBlueprint(Object.fromEntries(Object.entries(source).reverse()));
  assert.equal(a.blueprintSnapshotHash,b.blueprintSnapshotHash);
  assert.deepEqual(a.nodeOrder,b.nodeOrder);
  assert(!Object.isFrozen(source));assert(Object.isFrozen(a.blueprint.flow.nodes));
  const owned={nested:{value:1}},snapshot=frozenSnapshot(owned);
  assert(!Object.isFrozen(owned));assert(Object.isFrozen(snapshot.nested));
  assert.strictEqual(freezeOwned(owned),owned);assert(Object.isFrozen(owned.nested));
});
test('pure generation reproduces checked type and contract bytes',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../contracts/manifest.json',import.meta.url),'utf8'));
  const example=JSON.parse(await readFile(new URL('../examples/login.qa.json',import.meta.url),'utf8'));
  const rendered=renderContract({manifest,schema,example,presets:listPresets()});
  assert.equal(rendered.bundle,await readFile(new URL('../contracts/releases/'+rendered.artifact,import.meta.url),'utf8'));
  assert.equal(rendered.xml,await readFile(new URL('../contracts/releases/'+rendered.xmlArtifact,import.meta.url),'utf8'));
  assert.equal(renderTypes(schema),await readFile(new URL('../packages/core/schema-types.d.ts',import.meta.url),'utf8'));
});
