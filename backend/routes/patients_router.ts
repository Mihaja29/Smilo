import { Router } from 'express';
import {
  handleListPatients,
  handleGetPatient,
  handleGetNextId,
  handleCreatePatient,
  handleUpdatePatient,
  handleAddCareAct,
  handleDeletePatient,
} from '../controllers/patients_controller';

// ROUTEUR DES DOSSIERS PATIENTS ET SOINS
export const patientsRouter = Router();

patientsRouter.get('/', handleListPatients);
patientsRouter.get('/next-id', handleGetNextId);
patientsRouter.get('/:id', handleGetPatient);
patientsRouter.post('/', handleCreatePatient);
patientsRouter.put('/:id', handleUpdatePatient);
patientsRouter.post('/:id/care-history', handleAddCareAct);
patientsRouter.delete('/:id', handleDeletePatient);
