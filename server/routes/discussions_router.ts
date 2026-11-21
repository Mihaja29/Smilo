import { Router, Request, Response } from 'express';
import { DiscussionsService } from '../services/discussions_service';

export const discussionsRouter = Router();

function extractUidFromRequest(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return undefined;
  }
  const token = authHeader.slice(7).trim();
  if (!token || token === 'demo-token') {
    return undefined;
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return undefined;
  }
  try {
    const decoded = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    ) as { sub?: string; user_id?: string };
    return decoded.sub || decoded.user_id || undefined;
  } catch {
    return undefined;
  }
}

// ROUTES API DE L'ASSISTANT IA
discussionsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const tokenUid = extractUidFromRequest(req);
    const messages = await DiscussionsService.getMessages(tokenUid);
    res.json({
      success: true,
      data: messages,
      count: messages.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ success: false, error: message });
  }
});

discussionsRouter.post('/ask', async (req: Request, res: Response) => {
  try {
    const tokenUid = extractUidFromRequest(req);
    const bodyUid = typeof req.body?.authorUid === 'string' ? req.body.authorUid.trim() : '';
    const safeAuthorUid =
      tokenUid || (bodyUid.startsWith('demo-') ? bodyUid : 'demo-practitioner');

    const result = await DiscussionsService.askAi({
      conversationId: req.body?.conversationId,
      authorName: req.body?.authorName,
      authorUid: safeAuthorUid,
      prompt: req.body?.prompt,
      imageDataUrl: req.body?.imageDataUrl,
    });
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur de l'assistant IA";
    const status =
      message.includes('clé API') ||
      message.includes('NVIDIA_API_KEY') ||
      message.includes('expiré')
        ? 503
        : 400;
    res.status(status).json({ success: false, error: message });
  }
});

discussionsRouter.delete('/', async (req: Request, res: Response) => {
  try {
    const tokenUid = extractUidFromRequest(req);
    const conversationId =
      typeof req.query?.conversationId === 'string' ? req.query.conversationId : undefined;
    const deletedCount = await DiscussionsService.clearMessages(tokenUid, conversationId);
    res.json({
      success: true,
      deletedCount,
      message: 'Conversation réinitialisée',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur réinitialisation';
    res.status(500).json({ success: false, error: message });
  }
});
