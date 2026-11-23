import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

/** An error that is safe to show to the client. Anything else becomes a generic 500. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(message ?? code);
  }
}

export const badRequest = (code: string, details?: unknown) => new AppError(400, code, code, details);
export const unauthorized = (code = 'unauthorized') => new AppError(401, code);
export const forbidden = (code = 'forbidden') => new AppError(403, code);
export const notFound = (code = 'not_found') => new AppError(404, code);
export const conflict = (code: string, details?: unknown) => new AppError(409, code, code, details);

export function zodDetails(err: ZodError) {
  return err.issues.map((i) => ({ path: i.path.join('.'), code: i.code, message: i.message }));
}

export function errorHandler(err: FastifyError | Error, req: FastifyRequest, reply: FastifyReply) {
  if (err instanceof AppError) {
    return reply.status(err.status).send({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof ZodError) {
    return reply.status(400).send({ error: { code: 'validation_failed', message: 'validation_failed', details: zodDetails(err) } });
  }
  const fe = err as FastifyError & { code?: string };
  // Prisma unique constraint.
  if (fe.code === 'P2002') {
    return reply.status(409).send({ error: { code: 'already_exists', message: 'already_exists' } });
  }
  if (fe.code === 'P2025') {
    return reply.status(404).send({ error: { code: 'not_found', message: 'not_found' } });
  }
  if (typeof fe.statusCode === 'number' && fe.statusCode >= 400 && fe.statusCode < 500) {
    const code = fe.statusCode === 429 ? 'rate_limited' : fe.statusCode === 413 ? 'too_large' : 'bad_request';
    return reply.status(fe.statusCode).send({ error: { code, message: code } });
  }
  req.log.error({ err }, 'unhandled error');
  return reply.status(500).send({ error: { code: 'internal', message: 'internal' } });
}
