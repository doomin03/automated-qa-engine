const documentFlags = ['selectors', 'target-manifest', 'document-root', 'reference-root'];
const executionFlags = [...documentFlags, 'report', 'timeout', 'headed', 'headless', 'secrets-file', 'target', 'allow-production', 'appium-config'];
const rules = { schema: [1, []], template: [1, ['format', 'out']], import: [2, [...documentFlags, 'out']], export: [2, [...documentFlags, 'format', 'out']], expand: [2, ['out', 'format', 'document-root', 'source-map', 'source-out']], validate: [2, documentFlags], plan: [2, documentFlags], doctor: [1, ['target', 'appium-config']], devices: [1, ['target', 'appium-config']], run: [2, [...executionFlags, 'control-stdin']], 'run-suite': [2, [...executionFlags, 'control-stdin']], demo: [1, ['report', 'timeout', 'headed', 'headless', 'secrets-file', 'target', 'allow-production', 'reference-root']], agent: [1, ['config', 'once']] };
const usage = [
    "schema",
    "template [--format json|yaml|xml]",
    "import FILE [--out FILE]",
    "export FILE --format xml [--out FILE]",
    "expand FILE --out FILE [--format xml|json] [--source-map FILE] [--source-out FILE]",
    "preset list",
    "preset expand ID --preset-version VERSION --bindings FILE [--out FILE]",
    "validate FILE",
    "plan FILE",
    "run FILE [--report DIR] [--json] [--control-stdin]",
    "run-suite FILE [--control-stdin]",
    "doctor [--target web|android|ios] [--appium-config FILE]",
    "devices [--target web|android|ios] [--appium-config FILE]",
    "demo",
    "agent --config FILE [--once]"
];
export const commandCatalog = usage.map(label => ({ name: label.split(' ')[0], usage: label, rule: rules[label.split(' ')[0]] }));
export const commandRules = Object.fromEntries(commandCatalog.filter(c => c.rule).map(c => [c.name, c.rule]));
export const commandUsage = commandCatalog.map(c => c.usage);
