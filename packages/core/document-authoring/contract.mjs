// Pure schema/catalog data. The execution schema remains a separate contract.
export const AUTHORING_VERSION = '0.1.0-draft.1';
export const AUTHORING_SCHEMA_ID = 'urn:automated-qa:document-authoring:v1';
const execution = name => ({ $ref: 'urn:automated-qa:contracts:v1#/definitions/' + name });
const ref = name => ({ $ref: '#/definitions/' + name });
const string = { type: 'string', minLength: 1, maxLength: 128 };
const id = { ...string, not: { enum: ['__proto__', 'constructor', 'prototype'] } };
const sha = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const snapshot = { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' };
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, properties, required });
const list = (items, maxItems, minItems = 0) => ({ type: 'array', items, minItems, maxItems });
const common = { id, target: execution('target') };
const located = { ...common, selectors: execution('selectors'), launch: string, selector: string };
const value = { oneOf: [{ type: 'string', maxLength: 65536 }, object({ secretRef: string })] };
export const templateDefinitions = [
    { id: 'empty', version: '1.0.0', description: '빈 시작/종료 문서. 실제 검사가 아니며 조합 동작 자산으로는 사용할 수 없습니다.', supportedPlatforms: ['web', 'android', 'ios'], requiredActions: [], inputSchema: object(common) },
    { id: 'web-open-click', version: '1.0.0', description: '명시 대상 열기, 요소 대기, 클릭', supportedPlatforms: ['web'], requiredActions: ['launch', 'waitFor', 'tap'], inputSchema: object(located) },
    { id: 'web-input-check', version: '1.0.0', description: '명시 대상 열기, 요소 대기, 입력 및 값 확인', supportedPlatforms: ['web'], requiredActions: ['launch', 'waitFor', 'input', 'assertValue'], inputSchema: object({ ...located, value }) },
    { id: 'native-open-check', version: '1.0.0', description: '명시 native 앱 열기 및 요소 표시 확인. 기기 연결 증거가 아닙니다.', supportedPlatforms: ['android', 'ios'], requiredActions: ['launch', 'assertVisible'], inputSchema: object(located) },
];
const templateIds = { enum: templateDefinitions.map(t => t.id) };
export const authoringSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#', $id: AUTHORING_SCHEMA_ID,
    definitions: {
        composition: object({
            schemaVersion: { const: 'qa.composition/v1' },
            assets: list(object({ id, format: { enum: ['xml', 'json'] }, source: { type: 'string', minLength: 1, maxLength: 1048576 }, sha256: sha }), 64, 1),
            instances: list(object({ id, assetId: id }), 64, 1),
            links: list(object({ from: id, to: id }), 63),
        }),
        templateRequest: object({ templateId: templateIds, version: string, sha256: sha, bindings: { type: 'object' } }),
        templatePin: object({ id: templateIds, version: string, sha256: sha }),
        template: object({ id: templateIds, version: string, sha256: sha, description: { type: 'string' }, supportedPlatforms: list({ enum: ['web', 'android', 'ios'] }, 3, 1), requiredActions: list({ type: 'string' }, 16), inputSchema: { type: 'object' } }),
        catalog: object({ authoringContractVersion: { const: AUTHORING_VERSION }, templates: list(ref('template'), 4, 4) }),
        diagnostic: object({ code: string, path: { type: 'string', maxLength: 4096 }, message: { type: 'string', maxLength: 256 }, assetId: id, instanceId: id, sourceNodeId: id }, ['code', 'path', 'message']),
        sourceMap: object({
            schemaVersion: { const: 'qa.compositionSourceMap/v1' }, blueprintSnapshotHash: snapshot, flowSnapshotHash: snapshot,
            nodes: { type: 'object', maxProperties: 998, propertyNames: { pattern: '^b_[a-f0-9]{24}$' }, additionalProperties: object({ instanceId: id, assetId: id, sourceNodeId: string, sourceHash: sha }) },
            syntheticNodes: { const: ['composition_start', 'composition_end'] },
        }),
        result: object({
            schemaVersion: { const: 'qa.authoredBlueprint/v1' }, authoringContractVersion: { const: AUTHORING_VERSION },
            blueprint: execution('blueprint'), xml: { type: 'string', maxLength: 1048576 }, blueprintSnapshotHash: snapshot, flowSnapshotHash: snapshot,
            template: { anyOf: [ref('templatePin'), { type: 'null' }] }, sourceMap: { anyOf: [ref('sourceMap'), { type: 'null' }] },
            diagnostics: { type: 'array', maxItems: 0 },
        }),
        failure: object({ error: object({ code: string, message: { type: 'string', maxLength: 256 }, details: object({ diagnostics: list(ref('diagnostic'), 64, 1) }) }) }),
    },
};
