import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import type { NextFunction } from 'express';
import { validate } from './validate';

const mockReq = (body: any) => ({ body } as any);

const mockRes = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const testSchema = z.object({
  email: z.string().email(),
  age: z.number().min(0),
});

describe('validate middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn() as unknown as NextFunction;
  });

  it('calls next() on valid input', () => {
    const req = mockReq({ email: 'test@example.com', age: 25 });
    const res = mockRes();

    validate(testSchema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 with error details on invalid input', () => {
    const req = mockReq({ email: 'bad', age: -1 });
    const res = mockRes();

    validate(testSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation error',
        details: expect.any(Array),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('passes parsed body to next middleware', () => {
    const schema = z.object({
      name: z.string().trim(),
      count: z.number().default(1),
    });
    const req = mockReq({ name: '  hello  ' });
    const res = mockRes();

    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.body).toEqual({ name: 'hello', count: 1 });
  });

  it('forwards non-ZodError exceptions via next(err)', () => {
    const badSchema = {
      parse: () => {
        throw new Error('unexpected');
      },
    } as any;
    const req = mockReq({});
    const res = mockRes();

    validate(badSchema)(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.status).not.toHaveBeenCalled();
  });
});
