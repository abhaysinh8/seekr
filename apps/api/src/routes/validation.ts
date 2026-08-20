import { HttpError } from '../errors/http-error.js';

export interface ValidationSchema<T> {
  safeParse(value: unknown):
    | { readonly success: true; readonly data: T }
    | {
        readonly success: false;
        readonly error: { flatten(): unknown };
      };
}

export function parseRequest<T>(schema: ValidationSchema<T>, value: unknown, location: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', `Invalid ${location}`, result.error.flatten());
  }
  return result.data;
}
