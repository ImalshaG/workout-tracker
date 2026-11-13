export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NAME_TAKEN'
  | 'NOT_FOUND'
  | 'EXERCISE_IN_USE'
  | 'ORDER_MISMATCH'
  | 'INTERNAL_ERROR';

export interface ApiError {
  error: { code: ErrorCode; message: string; field?: string };
}

export function apiError(code: ErrorCode, message: string, field?: string): ApiError {
  return { error: field === undefined ? { code, message } : { code, message, field } };
}

/** True when `err` (or anything in its `cause` chain, e.g. a Drizzle wrapper) has the given SQLite error code. */
function hasSqliteCode(err: unknown, code: string): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 5; depth++) {
    if (typeof e === 'object' && 'code' in e && e.code === code) return true;
    e = typeof e === 'object' && 'cause' in e ? e.cause : undefined;
  }
  return false;
}

export const isUniqueViolation = (err: unknown) => hasSqliteCode(err, 'SQLITE_CONSTRAINT_UNIQUE');
export const isForeignKeyViolation = (err: unknown) => hasSqliteCode(err, 'SQLITE_CONSTRAINT_FOREIGNKEY');

/** "A", "A and B", "A, B and C" */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
