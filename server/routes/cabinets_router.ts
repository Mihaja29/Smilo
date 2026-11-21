import { Router, Request, Response } from 'express';
import { CabinetsService } from '../services/cabinets_service';
import { PatientsService } from '../services/patients_service';

export const cabinetsRouter = Router();

// ROUTES API DES CABINETS DENTAIRES
cabinetsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const cabinets = await CabinetsService.getAllCabinets();
    res.json({
      success: true,
      data: cabinets,
      count: cabinets.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
});

cabinetsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const created = await CabinetsService.createCabinet({
      name: req.body?.name,
      code: req.body?.code,
      description: req.body?.description,
    });
    res.status(201).json({
      success: true,
      data: created,
      message: 'Cabinet ajouté avec succès',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur validation';
    res.status(400).json({ success: false, error: message });
  }
});

cabinetsRouter.post('/transfer', async (req: Request, res: Response) => {
  try {
    const rawSource =
      typeof req.body?.sourceCabinet === 'string' ? req.body.sourceCabinet.trim() : '';
    const rawTarget =
      typeof req.body?.targetCabinet === 'string' ? req.body.targetCabinet.trim() : '';

    if (!rawSource || !rawTarget) {
      res.status(400).json({
        success: false,
        error: 'Les cabinets source et destinataire sont obligatoires.',
      });
      return;
    }

    if (rawSource.toLowerCase() === rawTarget.toLowerCase()) {
      res.status(400).json({
        success: false,
        error: 'Le cabinet source et le cabinet destinataire doivent être différents.',
      });
      return;
    }

    const cabinets = await CabinetsService.getAllCabinets();
    const source = cabinets.find(
      (c) => c.name.trim().toLowerCase() === rawSource.toLowerCase()
    );
    const target = cabinets.find(
      (c) => c.name.trim().toLowerCase() === rawTarget.toLowerCase()
    );

    if (!source || !target) {
      res.status(404).json({
        success: false,
        error: 'Cabinet source ou destinataire introuvable.',
      });
      return;
    }

    const result = await PatientsService.transferCabinetPatients(
      source.name,
      target.name
    );

    res.json({
      success: true,
      data: result,
      message: `${result.transferredCount} patient(s) transféré(s) vers ${target.name}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur transfert';
    res.status(500).json({ success: false, error: message });
  }
});

cabinetsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const result = await CabinetsService.updateCabinet(req.params.id, {
      name: req.body?.name,
      code: req.body?.code,
      description: req.body?.description,
    });
    if (!result) {
      res.status(404).json({ success: false, error: 'Cabinet introuvable' });
      return;
    }

    const { cabinet, previousName } = result;
    const nameChanged = previousName.trim() !== cabinet.name.trim();
    if (nameChanged) {
      await PatientsService.transferCabinetPatients(previousName, cabinet.name);
    }

    res.json({
      success: true,
      data: cabinet,
      nameChanged,
      message: 'Cabinet modifié avec succès',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur modification';
    res.status(400).json({ success: false, error: message });
  }
});

cabinetsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await CabinetsService.deleteCabinet(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Cabinet introuvable' });
      return;
    }
    res.json({ success: true, message: 'Cabinet supprimé avec succès' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur suppression';
    res.status(500).json({ success: false, error: message });
  }
});
