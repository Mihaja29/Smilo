import { Router, Request, Response } from 'express';
import { CoveragesService } from '../services/coverages_service';

export const coveragesRouter = Router();

// GET /api/prises-en-charge - Liste les prises en charge actives ou en corbeille
coveragesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const inTrash = req.query.inTrash === 'true' || req.query.corbeille === 'true';
    const items = await CoveragesService.getAllCoverages(inTrash);
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

// POST /api/prises-en-charge - Enregistre une nouvelle prise en charge
coveragesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const created = await CoveragesService.createCoverage({
      cabinetDentaire: req.body?.cabinetDentaire,
      numeroFacture: req.body?.numeroFacture,
      montantProposeAriary: req.body?.montantProposeAriary,
      montantAssuranceAriary: req.body?.montantAssuranceAriary,
      patientNomPrenom: req.body?.patientNomPrenom,
      nomSociete: req.body?.nomSociete,
      agence: req.body?.agence,
      numeroPriseEnCharge: req.body?.numeroPriseEnCharge,
      dateAttestation: req.body?.dateAttestation,
      createursPriseEnCharge: req.body?.createursPriseEnCharge,
      dateEnvoi: req.body?.dateEnvoi,
    });
    res.status(201).json({
      success: true,
      data: created,
      message: 'Prise en charge enregistrée avec succès',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur validation';
    res.status(400).json({ success: false, error: message });
  }
});

// DELETE /api/prises-en-charge/trash/empty - Vide la corbeille des prises en charge
coveragesRouter.delete('/trash/empty', async (_req: Request, res: Response) => {
  try {
    const count = await CoveragesService.emptyTrash();
    res.json({
      success: true,
      message: `${count} prises en charge supprimées définitivement`,
      count,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur vidage corbeille';
    res.status(500).json({ success: false, error: message });
  }
});

// PATCH /api/prises-en-charge/:id/status - Met a jour l'etat de traitement
coveragesRouter.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const updated = await CoveragesService.updateCoverageStatus(
      req.params.id,
      req.body?.etatTraitement,
      req.body?.dateObtentionCheque
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

// POST /api/prises-en-charge/:id/trash - Place une prise en charge en corbeille
coveragesRouter.post('/:id/trash', async (req: Request, res: Response) => {
  try {
    const item = await CoveragesService.moveToTrash(req.params.id);
    res.json({
      success: true,
      data: item,
      message: 'Prise en charge déplacée dans la corbeille',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur corbeille';
    res.status(400).json({ success: false, error: message });
  }
});

// POST /api/prises-en-charge/:id/restore - Restaure une prise en charge depuis la corbeille
coveragesRouter.post('/:id/restore', async (req: Request, res: Response) => {
  try {
    const item = await CoveragesService.restoreFromTrash(req.params.id);
    res.json({
      success: true,
      data: item,
      message: 'Prise en charge restaurée avec succès',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur restauration';
    res.status(400).json({ success: false, error: message });
  }
});

// PUT /api/prises-en-charge/:id - Met a jour les informations d'une prise en charge
coveragesRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const updated = await CoveragesService.updateCoverage(req.params.id, {
      cabinetDentaire: req.body?.cabinetDentaire,
      numeroFacture: req.body?.numeroFacture,
      montantProposeAriary: req.body?.montantProposeAriary,
      montantAssuranceAriary: req.body?.montantAssuranceAriary,
      patientNomPrenom: req.body?.patientNomPrenom,
      nomSociete: req.body?.nomSociete,
      agence: req.body?.agence,
      numeroPriseEnCharge: req.body?.numeroPriseEnCharge,
      dateAttestation: req.body?.dateAttestation,
      createursPriseEnCharge: req.body?.createursPriseEnCharge,
      dateEnvoi: req.body?.dateEnvoi,
    });
    res.json({
      success: true,
      data: updated,
      message: 'Prise en charge mise à jour avec succès',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur mise à jour';
    res.status(400).json({ success: false, error: message });
  }
});

// DELETE /api/prises-en-charge/:id/permanent - Supprime definitivement une prise en charge
coveragesRouter.delete('/:id/permanent', async (req: Request, res: Response) => {
  try {
    const deleted = await CoveragesService.deleteCoveragePermanently(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Prise en charge introuvable' });
      return;
    }
    res.json({ success: true, message: 'Prise en charge supprimée définitivement' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur suppression';
    res.status(500).json({ success: false, error: message });
  }
});

// DELETE /api/prises-en-charge/:id - Place une prise en charge en corbeille
coveragesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const item = await CoveragesService.moveToTrash(req.params.id);
    res.json({
      success: true,
      data: item,
      message: 'Prise en charge déplacée dans la corbeille',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Prise en charge introuvable';
    res.status(404).json({ success: false, error: message });
  }
});
