import type { Request, Response } from 'express';

// CONTROLEUR D'AUTHENTIFICATION ET SESSIONS
interface UserSession {
  uid: string;
  displayName: string;
  email: string;
  role: string;
  isDemo: boolean;
  createdAt: string;
}

let currentSession: UserSession | null = {
  uid: 'demo-practitioner-mathieu',
  displayName: 'Dr. Mathieu Andrianarivelo',
  email: 'mathieu.dr@smilo.mg',
  role: 'practitioner',
  isDemo: true,
  createdAt: new Date().toISOString(),
};

export function handleGetSession(_req: Request, res: Response): void {
  res.json({
    success: true,
    data: currentSession,
  });
}

export function handleCreateDemoSession(req: Request, res: Response): void {
  const { name, email } = req.body;

  currentSession = {
    uid: `demo-${Date.now()}`,
    displayName: name || 'Dr. Mathieu Andrianarivelo',
    email: email || 'mathieu.dr@smilo.mg',
    role: 'practitioner',
    isDemo: true,
    createdAt: new Date().toISOString(),
  };

  res.json({
    success: true,
    data: currentSession,
  });
}

export function handleLogout(_req: Request, res: Response): void {
  currentSession = null;
  res.json({
    success: true,
    message: 'Session terminee',
  });
}
