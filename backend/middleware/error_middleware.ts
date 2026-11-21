import type { Request, Response, NextFunction } from 'express';

// GESTIONNAIRE D'ERREURS GLOBAL
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Une erreur interne est survenue',
  });
}
