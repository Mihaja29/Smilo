import { Router } from 'express';
import {
  handleGetSession,
  handleCreateDemoSession,
  handleLogout,
} from '../controllers/auth_controller';

// ROUTEUR D'AUTHENTIFICATION
export const authRouter = Router();

authRouter.get('/session', handleGetSession);
authRouter.post('/demo-session', handleCreateDemoSession);
authRouter.post('/logout', handleLogout);
