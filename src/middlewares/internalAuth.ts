import { Request, Response, NextFunction } from 'express';

export const internalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
    res.status(403).json({ ok: false, message: 'Acceso no autorizado' });
    return;
  }

  next();
};
