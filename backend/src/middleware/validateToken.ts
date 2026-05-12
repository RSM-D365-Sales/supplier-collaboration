import { Request, Response, NextFunction } from 'express';
import { tokenService } from '../services/tokenService';

/**
 * Middleware that validates the vendor access token from the URL parameter.
 * Attaches the resolved TokenRecord to res.locals.tokenRecord.
 */
export function validateToken(req: Request, res: Response, next: NextFunction): void {
  const { token } = req.params;

  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Access token is required.' });
    return;
  }

  const record = tokenService.findToken(token);

  if (!record) {
    res.status(401).json({
      error: 'Invalid or expired access link. Please contact your buyer for a new invitation.',
    });
    return;
  }

  // Attach to locals so route handlers can use it without re-fetching
  res.locals.tokenRecord = record;
  next();
}
