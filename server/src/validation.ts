import type { Context, Env, ValidationTargets } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z, type ZodType } from 'zod';
import { apiError } from './errors.js';

export const NAME_MAX = 100;

/** zValidator that reports the first issue in the shared error shape, with `field`. */
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(target: Target, schema: T) {
  return zValidator(target, schema, (result, c: Context<Env>) => {
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue?.path[0];
      return c.json(
        apiError('VALIDATION_ERROR', issue?.message ?? 'Invalid request', field === undefined ? undefined : String(field)),
        400,
      );
    }
  });
}

/** Required, trimmed, 1–NAME_MAX characters. */
export const nameSchema = z
  .string({ error: 'Name is required' })
  .trim()
  .min(1, 'Name is required')
  .max(NAME_MAX, `Name must be ${NAME_MAX} characters or fewer`);

/** Path segment holding a positive integer id. */
export const idSegment = z
  .string()
  .regex(/^[1-9]\d{0,15}$/, 'Id must be a positive integer')
  .transform(Number);

/** Positive integer id in a JSON body. */
export const idValue = z.number({ error: 'Ids must be positive integers' }).int('Ids must be positive integers').positive('Ids must be positive integers');

export const DURATION_MAX_SECONDS = 3600;
export const REST_MAX_SECONDS = 600;

/** Work time for an exercise, in whole seconds (1s–60min). */
export const durationSchema = z
  .number({ error: 'Duration must be a whole number of seconds' })
  .int('Duration must be a whole number of seconds')
  .min(1, 'Duration must be at least 1 second')
  .max(DURATION_MAX_SECONDS, 'Duration must be 60 minutes or less');

/** Rest between exercises, in whole seconds (0–10min). */
export const restSchema = z
  .number({ error: 'Rest must be a whole number of seconds' })
  .int('Rest must be a whole number of seconds')
  .min(0, "Rest can't be negative")
  .max(REST_MAX_SECONDS, 'Rest must be 10 minutes or less');
