/** Convierte BigInt, Date, etc. a valores serializables en JSON */
export function serializeForJson<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, val) => {
      if (typeof val === 'bigint') return val.toString();
      return val;
    }),
  ) as T;
}
