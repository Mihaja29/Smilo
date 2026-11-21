import { Router } from 'express';
import { getPatientsHealth } from '../controllers/patients_controller';

// ROUTEUR DE SANTÉ DU SERVEUR
export const healthRouter = Router();

healthRouter.get('/', getPatientsHealth);
