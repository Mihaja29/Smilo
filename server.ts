import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import { patientsRouter } from './server/routes/patients_router';
import { assurancesRouter } from './server/routes/assurances_router';
import { coveragesRouter } from './server/routes/coverages_router';
import { cabinetsRouter } from './server/routes/cabinets_router';
import { prothesesRouter } from './server/routes/protheses_router';
import { discussionsRouter } from './server/routes/discussions_router';
import { runWithRequestAuthToken } from './server/services/firestore_sync';
import {
  isPackagedExecutable,
  resolveAppRoot,
  resolveDistPath,
} from './server/path_utils';

declare const __SMILO_PROD_BUNDLE__: boolean | undefined;

if (isPackagedExecutable()) {
  const exeEnvPath = path.join(path.dirname(process.execPath), '.env');
  if (fs.existsSync(exeEnvPath)) {
    dotenv.config({ path: exeEnvPath });
  }
}
dotenv.config();

function openBrowserOnExecutable(port: number): void {
  if (!isPackagedExecutable() || process.env.NO_OPEN_BROWSER === 'true') {
    return;
  }
  const url = `http://localhost:${port}`;
  try {
    if (process.platform === 'win32') {
      const child = spawn('cmd', ['/c', 'start', '', url], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.unref();
    } else if (process.platform === 'darwin') {
      const child = spawn('open', [url], { detached: true, stdio: 'ignore' });
      child.unref();
    } else {
      const child = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
      child.unref();
    }
  } catch {
    // Ouverture manuelle via le navigateur si le lanceur système échoue
  }
}

const APP_ROOT = resolveAppRoot(import.meta.url, '.');
const DIST_PATH = resolveDistPath(import.meta.url);

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;
  const isBundledServer =
    typeof __SMILO_PROD_BUNDLE__ !== 'undefined' && __SMILO_PROD_BUNDLE__;
  const hasDistBuild = fs.existsSync(path.join(DIST_PATH, 'index.html'));
  const isProd =
    isBundledServer ||
    process.env.NODE_ENV === 'production' ||
    isPackagedExecutable() ||
    (typeof __dirname !== 'undefined' && hasDistBuild);

  // Middlewares pour les requêtes JSON et URL-encodées
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Propagation du jeton Firebase utilisateur et journalisation des appels API
  app.use((req, _res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`[BACKEND ${req.method}] ${req.url}`);
      const authHeader = req.headers.authorization;
      const bearerToken =
        typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
          ? authHeader.slice(7).trim()
          : undefined;
      const validToken =
        bearerToken && bearerToken !== 'demo-token' ? bearerToken : undefined;
      runWithRequestAuthToken(validToken, () => next());
      return;
    }
    next();
  });

  // Endpoint de vérification de l'état du backend
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'Smilo Fullstack Backend API',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: isProd ? 'production' : 'development',
    });
  });

  // Montage des routes du backend
  app.use('/api/patients', patientsRouter);
  app.use('/api/assurances', assurancesRouter);
  app.use('/api/prises-en-charge', coveragesRouter);
  app.use('/api/cabinets', cabinetsRouter);
  app.use('/api/protheses', prothesesRouter);
  app.use('/api/discussions', discussionsRouter);

  // Gestion des routes API non trouvées
  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Route API introuvable',
    });
  });

  // Intégration du Frontend (Vite en dev, static en prod)
  if (typeof __SMILO_PROD_BUNDLE__ === 'undefined' && !isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
        allowedHosts: true,
        hmr: process.env.DISABLE_HMR !== 'true' ? { server: httpServer } : false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req: Request, res: Response, next: NextFunction) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const indexPath = path.resolve(APP_ROOT, 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    app.use(express.static(DIST_PATH));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(DIST_PATH, 'index.html'));
    });
  }

  // Middleware global d'erreur
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Erreur backend:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Erreur interne du serveur',
    });
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Smilo Fullstack] Serveur actif sur http://localhost:${PORT}`);
    openBrowserOnExecutable(PORT);
  });
}

startServer().catch((error) => {
  console.error('Erreur critique au lancement du serveur:', error);
  process.exit(1);
});
