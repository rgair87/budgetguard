import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZodError, ZodIssueCode } from 'zod';

vi.mock('../config/logger', () => ({
  default: { error: vi.fn() },
}));

const mockReq = () => ({} as any);

const mockRes = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const mockNext = vi.fn();

/**
 * Because errorHandler captures `isDev` at module scope, we need to
 * re-import the module with different env mocks for dev vs prod tests.
 */
async function loadErrorHandler(nodeEnv: string) {
  vi.doMock('../config/env', () => ({
    env: { NODE_ENV: nodeEnv },
  }));
  const mod = await import('./errorHandler');
  return mod.errorHandler;
}

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // re-mock logger after resetModules
    vi.doMock('../config/logger', () => ({
      default: { error: vi.fn() },
    }));
  });

  it('returns 500 for generic errors', async () => {
    const errorHandler = await loadErrorHandler('development');
    const res = mockRes();

    errorHandler(new Error('something broke'), mockReq(), res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'internal',
        message: 'something broke',
      }),
    );
  });

  it('returns 400 with validation details for ZodError', async () => {
    const errorHandler = await loadErrorHandler('development');
    const res = mockRes();
    const zodErr = new ZodError([
      {
        code: ZodIssueCode.invalid_type,
        expected: 'string',
        received: 'number',
        path: ['email'],
        message: 'Expected string, received number',
      },
    ]);

    errorHandler(zodErr, mockReq(), res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'validation_error',
        message: 'Validation failed',
        details: [{ path: 'email', message: 'Expected string, received number' }],
      }),
    );
  });

  it('returns 400 for SyntaxError with body property', async () => {
    const errorHandler = await loadErrorHandler('development');
    const res = mockRes();
    const err = Object.assign(new SyntaxError('Unexpected token'), { body: '{}' });

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'bad_request',
      message: 'Invalid request body',
    });
  });

  it('uses error.status when available', async () => {
    const errorHandler = await loadErrorHandler('development');
    const res = mockRes();
    const err = Object.assign(new Error('Not found'), { status: 404 });

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'error',
        message: 'Not found',
      }),
    );
  });

  it('uses error.statusCode when available', async () => {
    const errorHandler = await loadErrorHandler('development');
    const res = mockRes();
    const err = Object.assign(new Error('Forbidden'), { statusCode: 403 });

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('includes stack trace in development mode', async () => {
    const errorHandler = await loadErrorHandler('development');
    const res = mockRes();
    const err = new Error('dev error');

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.stack).toBeDefined();
    expect(body.stack).toContain('dev error');
  });

  it('excludes stack trace in production mode', async () => {
    const errorHandler = await loadErrorHandler('production');
    const res = mockRes();
    const err = new Error('prod error');

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.stack).toBeUndefined();
  });

  it('hides error message for 500s in production mode', async () => {
    const errorHandler = await loadErrorHandler('production');
    const res = mockRes();
    const err = new Error('sensitive internal detail');

    errorHandler(err, mockReq(), res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
  });
});
