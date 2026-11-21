import express from 'express';
import { apiRouter } from './routes/api_router';
import { errorHandler } from './middleware/error_middleware';

// CONFIGURATION APPLICATION EXPRESS
export function createBackendApp(): express.Express {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/api', apiRouter);

  app.use(errorHandler);

  return app;
}
