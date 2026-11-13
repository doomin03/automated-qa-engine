import { ENGINE_VERSION } from './metadata.mjs';
import { commandUsage } from './catalog.mjs';
export function helpText() {
    return `Automated QA Engine ${ENGINE_VERSION}

Usage: aqa <command> [options]

  template --format xml             Create a Blueprint template
  validate FILE                    Validate without execution
  plan FILE                        Show immutable execution plan
  run FILE --json --report DIR      Execute and stream JSONL events
  run-suite FILE                   Execute sequential test cases
  export FILE --format xml          Export Blueprint XML
  expand FILE --out FILE            Expand bounded authoring and preserve source/map
  preset list                      List versioned local UX presets
  preset expand ID --preset-version VERSION --bindings FILE --out FILE
  doctor / devices                 Check runtime or static native configuration
  agent --config FILE [--once]      Explicit standalone worker (server opt-in)

Example:
  aqa template --format xml --out test.xml
  aqa validate test.xml
  aqa run test.xml --json --diagnostics stderr

Options: --reference-root DIR, --document-root DIR, --control-stdin,
         --appium-config FILE, --timeout MS, --headed
Use --help --json for machine-readable help. Import/validation/expand never execute.
Extra positional arguments, unrelated options and --headed/--headless conflicts are rejected.
`;
}
export function help() {
    return { name: 'aqa', engineVersion: ENGINE_VERSION, commands: commandUsage, options: { diagnostics: 'stdout (default) | stderr', controlStdin: 'UTF-8 JSONL {"type":"cancel"}; empty EOF does not cancel', documentRoot: 'Optional realpath containment for input documents', referenceRoot: 'Local assets for design checks', appiumConfig: 'Explicit local native connection configuration' }, policy: 'Import, export, expand and validation never execute. Use run explicitly. Secrets only through environment or an ignored secrets file.' };
}
