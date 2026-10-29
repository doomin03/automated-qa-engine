export class QaError extends Error {
  constructor(code, message, phase = 'validation', details = []) {
    super(message); this.name = 'QaError'; this.code = code; this.phase = phase; this.details = details;
  }
}
export function ensure(condition, code, message) { if (!condition) throw new QaError(code, message); }
export function exitCode(outcomeOrCode) {
  if (outcomeOrCode === 'passed') return 0;
  if (outcomeOrCode === 'failed') return 1;
  if (outcomeOrCode === 'cancelled' || outcomeOrCode === 'CANCELLED') return 5;
  if (['blocked', 'UNSUPPORTED_CAPABILITY', 'SECRET_NOT_FOUND', 'POLICY_DENIED'].includes(outcomeOrCode)) return 4;
  if (['infra_error','ENGINE_ERROR','SESSION_ERROR','RUNNER_CRASH'].includes(outcomeOrCode)) return 3;
  return 2;
}

