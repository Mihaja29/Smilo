import { Router, Request, Response } from 'express';
import { ProthesesService } from '../services/protheses_service';

export const prothesesRouter = Router();

// GET /api/protheses - Liste les protheses dentaires actives ou en corbeille
prothesesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const inTrash = req.query.inTrash === 'true' || req.query.corbeille === 'true';
    const items = await ProthesesService.getAllProtheses(inTrash);
    res.json({
      success: true,
      data: items,
      count: items.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
});

// POST /api/protheses - Enregistre une nouvelle prothese dentaire
prothesesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const created = await ProthesesService.createProthesis({
      id: req.body?.id,
      cabinetDentaire: req.body?.cabinetDentaire,
      patientNomPrenom: req.body?.patientNomPrenom,
      patientContact: req.body?.patientContact,
      numeroDentaire: req.body?.numeroDentaire,
      typeProthese: req.body?.typeProthese,
      teinteProthese: req.body?.teinteProthese,
      nomLaboratoire: req.body?.nomLaboratoire,
      nomCreateurProthese: req.body?.nomCreateurProthese,
      dateEnvoi: req.body?.dateEnvoi,
      dateLivraison: req.body?.dateLivraison,
      montant: req.body?.montant,
      etatTraitement: req.body?.etatTraitement,
      deleted: req.body?.deleted,
      deletedAt: req.body?.deletedAt,
      createdAt: req.body?.createdAt,
      updatedAt: req.body?.updatedAt,
    });
    res.status(201).json({
      success: true,
      data: created,
      message: 'Prothèse dentaire enregistrée avec succès',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur validation';
    res.status(400).json({ success: false, error: message });
  }
});

// DELETE /api/protheses/trash/empty - Vide la corbeille des protheses
prothesesRouter.delete('/trash/empty', async (_req: Request, res: Response) => {
  try {
    const count = await ProthesesService.emptyTrash();
    res.json({
      success: true,
      message: `${count} prothèses supprimées définitivement`,
      count,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur vidage corbeille';
    res.status(500).json({ success: false, error: message });
  }
});

// PATCH /api/protheses/:id/status - Met a jour l'etat de traitement
prothesesRouter.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const updated = await ProthesesService.updateProthesisStatus(
      req.params.id,
      req.body?.etatTraitement
    );
    res.json({
      success: true,
      data: updated,
      message: 'État de traitement mis à jour',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur mise à jour';
    res.status(400).json({ success: false, error: message });
  }
});

// POST /api/protheses/:id/trash - Place une prothese en corbeille
prothesesRouter.post('/:id/trash', async (req: Request, res: Response) => {
  try {
    const item = await ProthesesService.moveToTrash(req.params.id);
    res.json({
      success: true,
      data: item,
      message: 'Prothèse déplacée dans la corbeille',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur corbeille';
    res.status(400).json({ success: false, error: message });
  }
});

// POST /api/protheses/:id/restore - Restaure une prothese depuis la corbeille
prothesesRouter.post('/:id/restore', async (req: Request, res: Response) => {
  try {
    const item = await ProthesesService.restoreFromTrash(req.params.id);
    res.json({
      success: true,
      data: item,
      message: 'Prothèse restaurée avec succès',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur restauration';
    res.status(400).json({ success: false, error: message });
  }
});

// PUT /api/protheses/:id - Met a jour les informations d'une prothese
prothesesRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const updated = await ProthesesService.updateProthesis(req.params.id, {
      cabinetDentaire: req.body?.cabinetDentaire,
      patientNomPrenom: req.body?.patientNomPrenom,
      patientContact: req.body?.patientContact,
      numeroDentaire: req.body?.numeroDentaire,
      typeProthese: req.body?.typeProthese,
      teinteProthese: req.body?.teinteProthese,
      nomLaboratoire: req.body?.nomLaboratoire,
      nomCreateurProthese: req.body?.nomCreateurProthese,
      dateEnvoi: req.body?.dateEnvoi,
      dateLivraison: req.body?.dateLivraison,
      montant: req.body?.montant,
    });
    res.json({
      success: true,
      data: updated,
      message: 'Prothèse mise à jour avec succès',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur mise à jour';
    res.status(400).json({ success: false, error: message });
  }
});

// DELETE /api/protheses/:id/permanent - Supprime definitivement une prothese
prothesesRouter.delete('/:id/permanent', async (req: Request, res: Response) => {
  try {
    const deleted = await ProthesesService.deleteProthesisPermanently(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Prothèse introuvable' });
      return;
    }
    res.json({ success: true, message: 'Prothèse supprimée définitivement' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur suppression';
    res.status(500).json({ success: false, error: message });
  }
});

// DELETE /api/protheses/:id - Place une prothese en corbeille
prothesesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const item = await ProthesesService.moveToTrash(req.params.id);
    res.json({
      success: true,
      data: item,
      message: 'Prothèse déplacée dans la corbeille',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Prothèse introuvable';
    res.status(404).json({ success: false, error: message });
  }
});
