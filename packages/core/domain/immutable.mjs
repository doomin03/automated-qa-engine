// Freeze a value owned by the caller; do not clone or freeze its source implicitly.
export function freezeOwned(value) {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freezeOwned);
        Object.freeze(value);
    }
    return value;
}
// Durable reports detach their contents before exposing a frozen snapshot.
export function frozenSnapshot(value) {
    return freezeOwned(structuredClone(value));
}
