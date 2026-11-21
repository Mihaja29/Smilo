import type { Request, Response } from 'express';
import { patientsService } from '../services/patients_service';

// CONTROLEUR DES DOSSIERS PATIENTS ET ACTES DE SOINS
export function handleListPatients(_req: Request, res: Response): void {
  try {
    const patients = patientsService.getAllPatients();
    res.json({
      success: true,
      data: patients,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recuperation des dossiers patients',
    });
  }
}

export function handleGetPatient(req: Request, res: Response): void {
  const { id } = req.params;
  const patient = patientsService.getPatientById(id);

  if (!patient) {
    res.status(404).json({
      success: false,
      message: 'Dossier patient introuvable',
    });
    return;
  }

  res.json({
    success: true,
    data: patient,
  });
}

export function handleGetNextId(req: Request, res: Response): void {
  const cabinet = (req.query.cabinet as string) || 'Anjanahary';
  const nextId = patientsService.getNextIdPreview(cabinet);

  res.json({
    success: true,
    data: {
      cabinet,
      nextId,
    },
  });
}

export function handleCreatePatient(req: Request, res: Response): void {
  const { nom, prenom, cabinet, telephone } = req.body;

  if (!nom || !prenom || !cabinet) {
    res.status(400).json({
      success: false,
      message: 'Le nom, le prenom et le cabinet sont obligatoires',
    });
    return;
  }

  try {
    const created = patientsService.createPatient(req.body);
    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la creation du dossier patient',
    });
  }
}

export function handleUpdatePatient(req: Request, res: Response): void {
  const { id } = req.params;
  const updated = patientsService.updatePatient(id, req.body);

  if (!updated) {
    res.status(404).json({
      success: false,
      message: 'Dossier patient introuvable pour la mise a jour',
    });
    return;
  }

  res.json({
    success: true,
    data: updated,
  });
}

export function handleAddCareAct(req: Request, res: Response): void {
  const { id } = req.params;
  const { date, actesProduitsMedicaments, montant, observations } = req.body;

  if (!actesProduitsMedicaments) {
    res.status(400).json({
      success: false,
      message: 'Le detail des actes et produits est obligatoire',
    });
    return;
  }

  const updatedPatient = patientsService.addCareAct(id, {
    date: date || new Date().toISOString().split('T')[0],
    actesProduitsMedicaments,
    montant: montant || '0 Ar',
    observations: observations || '',
  });

  if (!updatedPatient) {
    res.status(404).json({
      success: false,
      message: 'Dossier patient introuvable pour ajouter le soin',
    });
    return;
  }

  res.status(201).json({
    success: true,
    data: updatedPatient,
  });
}

export function handleDeletePatient(req: Request, res: Response): void {
  const { id } = req.params;
  const deleted = patientsService.deletePatient(id);

  if (!deleted) {
    res.status(404).json({
      success: false,
      message: 'Dossier patient introuvable pour la suppression',
    });
    return;
  }

  res.json({
    success: true,
    message: 'Dossier supprime avec succes',
  });
}

export function getPatientsHealth(_req: Request, res: Response): void {
  res.json({
    status: 'ok',
    service: 'Smilo Patients Service',
    timestamp: new Date().toISOString(),
  });
}

