import { Router, Request, Response } from 'express';
import { PatientsService } from '../services/patients_service';

export const patientsRouter = Router();

// GET /api/patients - Liste tous les patients avec filtres
patientsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const cabinet = typeof req.query.cabinet === 'string' ? req.query.cabinet : undefined;
    const inTrash = req.query.inTrash === 'true' || req.query.corbeille === 'true';

    const patients = await PatientsService.getAllPatients({
      search,
      cabinet,
      inTrash,
    });

    res.json({
      success: true,
      data: patients,
      count: patients.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/patients/stats - Statistiques globales
patientsRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await PatientsService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/patients/next-id - Obtient le prochain identifiant valide via query param
patientsRouter.get('/next-id', async (req: Request, res: Response) => {
  try {
    const cabinet = (req.query.cabinet as string) || 'Anjanahary';
    const nextId = await PatientsService.getNextRecordId(cabinet);
    res.json({ success: true, data: { cabinet, nextId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur validation';
    res.status(400).json({ success: false, error: message });
  }
});

// GET /api/patients/next-id/:cabinet - Obtient le prochain identifiant valide
patientsRouter.get('/next-id/:cabinet', async (req: Request, res: Response) => {
  try {
    const { cabinet } = req.params;
    const nextId = await PatientsService.getNextRecordId(cabinet);
    res.json({ success: true, data: { cabinet, nextId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur validation';
    res.status(400).json({ success: false, error: message });
  }
});

// GET /api/patients/:id - Récupère une fiche patient par son identifiant technique
patientsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const patient = await PatientsService.getPatientById(id);
    if (!patient) {
      res.status(404).json({ success: false, error: 'Patient introuvable' });
      return;
    }
    res.json({ success: true, data: patient });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
});

// POST /api/patients - Enregistre une nouvelle fiche patient
patientsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const newPatient = await PatientsService.createPatient(req.body);
    res.status(201).json({
      success: true,
      data: newPatient,
      message: 'Fiche patient créée avec succès',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur lors de la création';
    res.status(400).json({ success: false, error: message });
  }
});

// PUT /api/patients/:id - Met à jour les informations d'un patient
patientsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await PatientsService.updatePatient(id, req.body);
    res.json({
      success: true,
      data: updated,
      message: 'Fiche patient mise à jour',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur mise à jour';
    res.status(400).json({ success: false, error: message });
  }
});

// DELETE /api/patients - Supprime toutes les fiches patients
patientsRouter.delete('/', async (_req: Request, res: Response) => {
  try {
    await PatientsService.clearAllPatients();
    res.json({ success: true, message: 'Toutes les fiches ont été supprimées avec succès' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur suppression';
    res.status(500).json({ success: false, error: message });
  }
});

// DELETE /api/patients/trash/empty - Vide complètement la corbeille
patientsRouter.delete('/trash/empty', async (_req: Request, res: Response) => {
  try {
    const count = await PatientsService.emptyTrash();
    res.json({ success: true, message: `${count} fiches supprimées définitivement`, count });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur vidage corbeille';
    res.status(500).json({ success: false, error: message });
  }
});

// POST /api/patients/:id/trash - Place une fiche en corbeille
patientsRouter.post('/:id/trash', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const patient = await PatientsService.moveToTrash(id);
    res.json({ success: true, data: patient, message: 'Fiche déplacée dans la corbeille' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur corbeille';
    res.status(400).json({ success: false, error: message });
  }
});

// POST /api/patients/:id/restore - Restaure une fiche depuis la corbeille
patientsRouter.post('/:id/restore', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const patient = await PatientsService.restoreFromTrash(id);
    res.json({ success: true, data: patient, message: 'Fiche restaurée avec succès' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur restauration';
    res.status(400).json({ success: false, error: message });
  }
});

// DELETE /api/patients/:id/permanent - Supprime définitivement une fiche
patientsRouter.delete('/:id/permanent', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await PatientsService.deletePatientPermanently(id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Patient introuvable' });
      return;
    }
    res.json({ success: true, message: 'Fiche supprimée définitivement' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur suppression définitive';
    res.status(500).json({ success: false, error: message });
  }
});

// DELETE /api/patients/:id - Supprime une fiche patient (déplacement en corbeille)
patientsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await PatientsService.deletePatient(id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Patient non trouvé' });
      return;
    }
    res.json({ success: true, message: 'Fiche patient placée dans la corbeille' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur suppression';
    res.status(500).json({ success: false, error: message });
  }
});

// POST /api/patients/:id/soins - Ajoute un acte ou soin à l'historique
patientsRouter.post('/:id/soins', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const careItem = await PatientsService.addCareItem(id, req.body);
    res.status(201).json({
      success: true,
      data: careItem,
      message: 'Soin ajouté avec succès',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur ajout d'acte";
    res.status(400).json({ success: false, error: message });
  }
});

// PUT /api/patients/:id/soins/:soinId - Met à jour un soin de l'historique
patientsRouter.put('/:id/soins/:soinId', async (req: Request, res: Response) => {
  try {
    const { id, soinId } = req.params;
    const updatedPatient = await PatientsService.updateCareItem(id, soinId, req.body);
    res.json({
      success: true,
      data: updatedPatient,
      message: 'Soin mis à jour avec succès',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur modification soin';
    res.status(400).json({ success: false, error: message });
  }
});

// DELETE /api/patients/:id/soins/:soinId - Supprime un soin de l'historique
patientsRouter.delete('/:id/soins/:soinId', async (req: Request, res: Response) => {
  try {
    const { id, soinId } = req.params;
    const deleted = await PatientsService.deleteCareItem(id, soinId);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Soin ou patient introuvable' });
      return;
    }
    res.json({ success: true, message: 'Soin supprimé avec succès' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur suppression soin';
    res.status(500).json({ success: false, error: message });
  }
});
