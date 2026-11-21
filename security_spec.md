# Specification de Securite Firestore - Smilo

## 1. Architecture & Collections Combinees
Toutes les regles de securite sont unifiees dans `firestore.rules` (v2) pour la base `(default)` du projet `dentia-horizon` :

1. `/admins/{adminId}` : Registre des UIDs administrateurs et du compte de service backend (`role == 'service'`, `createdAt`).
2. `/patients/{patientId}` : Dossiers patients individuels, incluant `historiqueSoins`, `antecedents`, `allergies`, `traitements`, `grossesseAllaitement`, `deleted`, `deletedAt`, `createdBy`, `createdAt`, `updatedAt`.
3. `/assurances/{assuranceId}` : Organismes d'assurance (`label`, `displayLabel`, `description`, `isDefault`, `deleted`, `deletedAt`, `createdBy`, `createdAt`, `updatedAt`).
4. `/prises_en_charge/{priseEnChargeId}` : Suivi des prises en charge (`etatTraitement` in `['En cours', 'Reçu']`, montants, societes, dates, `deleted`, `createdBy`, `createdAt`, `updatedAt`).
5. `/protheses/{protheseId}` : Suivi des protheses dentaires (`etatTraitement` in `['En cours', 'Terminer']`, laboratoire, teinte, dates, `deleted`, `createdBy`, `createdAt`, `updatedAt`).
6. `/cabinets/{cabinetId}` : Cabinets dentaires (`name`, `code` `^[A-Z]{2,6}$`, `description`, `isDefault`, `deleted`, `createdBy`, `createdAt`, `updatedAt`).
7. `/discussions/{discussionId}` : Demandes utilisateur, images jointes (`imageDataUrl` base64 PNG/JPEG/WEBP <= 800 Ko), reponses de l'assistant IA Diana et historique complet des conversations (`conversationId`, `role` in `['user', 'assistant']`, `authorName`, `authorUid`, `content`, `deleted`, `deletedAt`, `createdBy`, `createdAt`, `updatedAt`).

## 2. Invariants de Securite (8 Piliers)
- **Refus global par defaut** : `match /{document=**} { allow read, write: if false; }` present en tete.
- **Authentification stricte** : Aucune lecture ni ecriture anonyme (`request.auth != null`). Les utilisateurs standards doivent avoir `request.auth.token.email_verified == true`.
- **Autorisation RBAC & Propriete** :
  - `isBootstrappedAdmin()` : Comptes administrateurs verifies explicitement autorises (`antokofaha9faravohitra@gmail.com`, `mathieuromeo2025@gmail.com`, `rabarisoaharimalala@gmail.com`, `mathieuandrianarivelo03@gmail.com`).
  - `isAdmin()` : `isBootstrappedAdmin()` ou presence du document `/admins/$(request.auth.uid)` (compte service backend).
  - Proprietaire (`isOwner(existing())`) : `createdBy == request.auth.uid` (et pour `discussions`, `authorUid == request.auth.uid` a la creation pour les utilisateurs standards).
- **Immutabilite** : `createdAt`, `createdBy` (et `identifiant` sur `patients`, `authorUid` et `role` sur `discussions`) sont immutables apres creation.
- **Mutation stricte (`affectedKeys().hasOnly(...)`)** : Chaque `allow update` restreint explicitement les champs modifiables.
- **Validation stricte des types, tailles et formats** : Toutes les longueurs maximales, regex (`identifiant`, `code`, `imageDataUrl`, `conversationId`), et enumerations (`sexe`, `etatTraitement`, `role`) sont verifiees cote regles.

## 3. Payloads Adversariaux ("Dirty Dozen")
1. **Lecture/Ecriture non authentifiee** (`request.auth == null`) sur `/discussions` ou `/patients` -> REFUSE.
2. **Email non verifie** (`email_verified == false`) d'un utilisateur non-admin tentant de creer un patient ou une discussion -> REFUSE.
3. **Spoofing d'identite** (`createdBy != request.auth.uid` ou `authorUid != request.auth.uid`) a la creation d'une discussion par un utilisateur non-admin -> REFUSE.
4. **Escalade de privilege** : Un utilisateur non-admin tentant de se creer un document `/admins/{uid}` -> REFUSE.
5. **Champ non autorise (mass assignment)** : Ajout d'une cle `isAdmin: true` ou `extra: "hack"` sur `/discussions` ou `/patients` -> REFUSE (`hasOnly`).
6. **Modification de propriete immutable** : Tentative de changer `createdBy`, `createdAt`, `authorUid` ou `role` lors d'un `update` sur `/discussions/{id}` -> REFUSE.
7. **Image malveillante / XSS data URI** : `imageDataUrl: "data:text/html;base64,..."` ou `"javascript:alert(1)"` sur `/discussions` -> REFUSE (regex `^data:image/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$`).
8. **Payload surdimensionne (DoS stockage)** : `content.size() > 4000` ou `imageDataUrl.size() > 800000` -> REFUSE.
9. **Lecture transversale (IDOR)** : Utilisateur A tentant `get` ou `list` sur les discussions ou patients de l'utilisateur B (`createdBy != uid`) -> REFUSE.
10. **Path traversal dans l'ID document** : ID contenant `/`, `.`, espace ou > 128 caracteres -> REFUSE (`isValidId`).
11. **Modification du registre `/admins`** : Tentative de `list`, `update`, ou `delete` sur `/admins/{id}` -> REFUSE.
12. **Acces a une collection inconnue** (`/secrets/{id}`) -> REFUSE par la regle catch-all.
