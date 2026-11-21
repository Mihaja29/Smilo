export interface SecurityTestCase {
  id: string;
  collection:
    | 'admins'
    | 'patients'
    | 'assurances'
    | 'prises_en_charge'
    | 'protheses'
    | 'cabinets'
    | 'discussions'
    | 'unknown';
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  actor: 'anonymous' | 'unverifiedUser' | 'verifiedOwner' | 'otherUser' | 'bootstrappedAdmin' | 'serviceAdmin';
  expected: 'ALLOW' | 'DENY';
  description: string;
  payload?: Record<string, unknown>;
}

export const FIRESTORE_SECURITY_TEST_CASES: SecurityTestCase[] = [
  {
    id: 'TC-01',
    collection: 'discussions',
    operation: 'create',
    actor: 'anonymous',
    expected: 'DENY',
    description: 'Un utilisateur anonyme ne peut pas enregistrer une demande IA',
  },
  {
    id: 'TC-02',
    collection: 'discussions',
    operation: 'create',
    actor: 'unverifiedUser',
    expected: 'DENY',
    description: 'Un utilisateur avec email non verifie ne peut pas creer de discussion',
  },
  {
    id: 'TC-03',
    collection: 'discussions',
    operation: 'create',
    actor: 'verifiedOwner',
    expected: 'ALLOW',
    description: 'Un utilisateur verifie peut enregistrer sa demande et une image valide',
    payload: {
      conversationId: 'conv_1710000000000',
      role: 'user',
      authorName: 'Dr. Mathieu',
      authorUid: 'uid-owner',
      content: 'Analyser cette radiographie',
      imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
      deleted: false,
      deletedAt: null,
      createdBy: 'uid-owner',
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
    },
  },
  {
    id: 'TC-04',
    collection: 'discussions',
    operation: 'create',
    actor: 'verifiedOwner',
    expected: 'DENY',
    description: 'Spoofing de createdBy ou authorUid rejete a la creation',
    payload: {
      conversationId: 'conv_1',
      role: 'user',
      authorName: 'Attaquant',
      authorUid: 'uid-victim',
      content: 'Test spoofing',
      createdBy: 'uid-victim',
      createdAt: '2026-03-01T10:00:00.000Z',
    },
  },
  {
    id: 'TC-05',
    collection: 'discussions',
    operation: 'create',
    actor: 'verifiedOwner',
    expected: 'DENY',
    description: 'URI image non autorisee (HTML/SVG/XSS) rejetee',
    payload: {
      conversationId: 'conv_1',
      role: 'user',
      authorName: 'Test',
      authorUid: 'uid-owner',
      content: 'Image invalide',
      imageDataUrl: 'data:image/svg+xml;base64,PHN2Zz4=',
      createdBy: 'uid-owner',
      createdAt: '2026-03-01T10:00:00.000Z',
    },
  },
  {
    id: 'TC-06',
    collection: 'discussions',
    operation: 'get',
    actor: 'otherUser',
    expected: 'DENY',
    description: 'Un autre utilisateur ne peut pas lire l historique de discussion d un tiers',
  },
  {
    id: 'TC-07',
    collection: 'discussions',
    operation: 'list',
    actor: 'bootstrappedAdmin',
    expected: 'ALLOW',
    description: 'L administrateur bootstrappe (mathieuandrianarivelo03@gmail.com) peut lister les discussions',
  },
  {
    id: 'TC-08',
    collection: 'discussions',
    operation: 'update',
    actor: 'verifiedOwner',
    expected: 'DENY',
    description: 'Tentative de modification du role ou authorUid ou createdBy rejetee',
  },
  {
    id: 'TC-09',
    collection: 'admins',
    operation: 'create',
    actor: 'verifiedOwner',
    expected: 'DENY',
    description: 'Escalade de privilege : un utilisateur standard ne peut pas creer de doc admin',
  },
  {
    id: 'TC-10',
    collection: 'admins',
    operation: 'create',
    actor: 'bootstrappedAdmin',
    expected: 'ALLOW',
    description: 'Un admin bootstrappe peut enregistrer le compte de service backend',
  },
  {
    id: 'TC-11',
    collection: 'patients',
    operation: 'update',
    actor: 'verifiedOwner',
    expected: 'ALLOW',
    description: 'Le proprietaire peut mettre a jour historiqueSoins sur son patient',
  },
  {
    id: 'TC-12',
    collection: 'unknown',
    operation: 'get',
    actor: 'bootstrappedAdmin',
    expected: 'DENY',
    description: 'La regle catch-all bloque toute collection non declaree',
  },
];
