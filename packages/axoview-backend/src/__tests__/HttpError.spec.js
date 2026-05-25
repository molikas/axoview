import { HttpError } from '../routes.js';

describe('HttpError', () => {
  test('string message wraps to { error } body and exposes status', () => {
    const err = new HttpError(400, 'Invalid id');
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(400);
    expect(err.body).toEqual({ error: 'Invalid id' });
    expect(err.message).toBe('Invalid id');
  });

  test('object message passes through as body and surfaces .error as message', () => {
    const err = new HttpError(409, { error: 'Conflict', detail: 'already exists' });
    expect(err.status).toBe(409);
    expect(err.body).toEqual({ error: 'Conflict', detail: 'already exists' });
    expect(err.message).toBe('Conflict');
  });

  test('object body without .error falls back to default message', () => {
    const err = new HttpError(500, { reason: 'oops' });
    expect(err.status).toBe(500);
    expect(err.body).toEqual({ reason: 'oops' });
    expect(err.message).toBe('error');
  });
});
