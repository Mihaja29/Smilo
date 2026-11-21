import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// RESOLUTION DES CHEMINS SERVEUR ET EXECUTABLE

export function isPackagedExecutable(): boolean {
  const pkgProcess = process as NodeJS.Process & { pkg?: unknown };
  if (pkgProcess.pkg) {
    return true;
  }
  const baseName = path.basename(process.execPath).toLowerCase();
  return (
    !baseName.startsWith('node') &&
    !baseName.startsWith('bun') &&
    !baseName.startsWith('tsx')
  );
}

export function resolveModuleDir(importMetaUrl?: string): string {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  if (importMetaUrl) {
    return path.dirname(fileURLToPath(importMetaUrl));
  }
  return process.cwd();
}

export function resolveAppRoot(
  importMetaUrl?: string,
  relativeFromModule = '.',
): string {
  if (typeof __dirname !== 'undefined') {
    if (
      fs.existsSync(path.join(__dirname, 'dist', 'index.html')) ||
      fs.existsSync(path.join(__dirname, 'firebase-applet-config.json'))
    ) {
      return __dirname;
    }
    const candidate = path.resolve(__dirname, relativeFromModule);
    if (
      fs.existsSync(path.join(candidate, 'dist', 'index.html')) ||
      fs.existsSync(path.join(candidate, 'firebase-applet-config.json'))
    ) {
      return candidate;
    }
    return __dirname;
  }
  return path.resolve(resolveModuleDir(importMetaUrl), relativeFromModule);
}

export function resolveDistPath(importMetaUrl?: string): string {
  const appRoot = resolveAppRoot(importMetaUrl, '.');
  const rootDist = path.join(appRoot, 'dist');
  if (fs.existsSync(path.join(rootDist, 'index.html'))) {
    return rootDist;
  }
  const cwdDist = path.join(process.cwd(), 'dist');
  if (fs.existsSync(path.join(cwdDist, 'index.html'))) {
    return cwdDist;
  }
  return rootDist;
}

export function resolveConfigPath(importMetaUrl?: string): string {
  const appRoot = resolveAppRoot(importMetaUrl, '../..');
  const rootConfig = path.join(appRoot, 'firebase-applet-config.json');
  if (fs.existsSync(rootConfig)) {
    return rootConfig;
  }
  return path.join(process.cwd(), 'firebase-applet-config.json');
}

export function resolveWritableDataDir(importMetaUrl?: string): string {
  if (isPackagedExecutable()) {
    return path.join(path.dirname(process.execPath), 'data');
  }
  const appRoot = resolveAppRoot(importMetaUrl, '../..');
  return path.join(appRoot, 'server', 'data');
}
