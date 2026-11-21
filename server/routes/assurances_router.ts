import { Router, Request, Response } from 'express';
import { AssurancesService } from '../services/assurances_service';

export const assurancesRouter = Router();

// GET /api/assurances - Liste les assurances actives ou en corbeille
assurancesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const inTrash = req.query.inTrash === 'true' || req.query.corbeille === 'true';
    const assurances = await AssurancesService.getAllAssurances(inTrash);
    res.json({
      success: true,
      data: assurances,
      count: assurances.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
});

// POST /api/assurances - Ajoute une nouvelle assurance
assurancesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const created = await AssurancesService.createAssurance({
      label: req.body?.label,
      description: req.body?.description,
    });
    res.status(201).json({
      success: true,
      data: created,
      message: 'Assurance ajoutée avec succès',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur validation';
    res.status(400).json({ success: false, error: message });
  }
});

// DELETE /api/assurances/trash/empty - Vide la corbeille des assurances
assurancesRouter.delete('/trash/empty', async (_req: Request, res: Response) => {
  try {
    const count = await AssurancesService.emptyTrash();
    res.json({
      success: true,
      message: `${count} assurances supprimées définitivement`,
      count,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur vidage corbeille';
    res.status(500).json({ success: false, error: message });
  }
});

// POST /api/assurances/:id/trash - Place une assurance en corbeille
assurancesRouter.post('/:id/trash', async (req: Request, res: Response) => {
  try {
    const item = await AssurancesService.moveToTrash(req.params.id);
    res.json({ success: true, data: item, message: 'Assurance déplacée dans la corbeille' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur corbeille';
    res.status(400).json({ success: false, error: message });
  }
});

// POST /api/assurances/:id/restore - Restaure une assurance depuis la corbeille
assurancesRouter.post('/:id/restore', async (req: Request, res: Response) => {
  try {
    const item = await AssurancesService.restoreFromTrash(req.params.id);
    res.json({ success: true, data: item, message: 'Assurance restaurée avec succès' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur restauration';
    res.status(400).json({ success: false, error: message });
  }
});

// DELETE /api/assurances/:id/permanent - Supprime definitivement une assurance
assurancesRouter.delete('/:id/permanent', async (req: Request, res: Response) => {
  try {
    const deleted = await AssurancesService.deleteAssurancePermanently(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Assurance introuvable' });
      return;
    }
    res.json({ success: true, message: 'Assurance supprimée définitivement' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur suppression';
    res.status(500).json({ success: false, error: message });
  }
});

// DELETE /api/assurances/:id - Place une assurance en corbeille
assurancesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const item = await AssurancesService.moveToTrash(req.params.id);
    res.json({ success: true, data: item, message: 'Assurance déplacée dans la corbeille' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Assurance introuvable';
    res.status(404).json({ success: false, error: message });
  }
});
