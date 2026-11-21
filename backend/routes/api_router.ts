import { Router } from 'express';
import { healthRouter } from './health_router';
import { patientsRouter } from './patients_router';
import { authRouter } from './auth_router';

// ROUTEUR PRINCIPAL API
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/patients', patientsRouter);
apiRouter.use('/auth', authRouter);
