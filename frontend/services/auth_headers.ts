import { auth } from '../firebase/firebase_app';

// EN-TETES AUTHENTIFICATION API BACKEND
export async function getAuthHeaders(
  extraHeaders?: Record<string, string>
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...(extraHeaders || {}) };
  try {
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.emailVerified) {
      const token = await currentUser.getIdToken();
      if (token && token !== 'demo-token') {
        headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch {
    // Session locale sans jeton Firebase
  }
  return headers;
}
