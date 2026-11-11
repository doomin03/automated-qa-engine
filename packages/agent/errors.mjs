export class AgentError extends Error {
    constructor(code, message) { super(message); this.name = 'AgentError'; this.code = code; }
}
export function requireAgent(condition, code, message) { if (!condition)
    throw new AgentError(code, message); }
