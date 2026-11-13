import { QaError } from '../../packages/core/errors.mjs';
export function configurationError() { return new QaError('INVALID_DOCUMENT', 'Invalid Appium execution configuration', 'session'); }
export function protocolError(phase = 'step') { return new QaError('SESSION_ERROR', 'Appium protocol operation failed', phase); }
export const unsupported = () => new QaError('UNSUPPORTED_CAPABILITY', 'Unsupported native capability', 'step');
export const assertionFailure = () => new QaError('ASSERTION_FAILED', 'Native assertion did not match expected value', 'step');
