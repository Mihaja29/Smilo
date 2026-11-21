# Directives & Charte Graphique du Projet

## Palette de Couleurs Obligatoire
Pour tous les développements futurs et interfaces du projet, respecter scrupuleusement la palette de couleurs suivante :
- **Fond principal (Canvas)** : `#FFFFFF` (Blanc pur)
- **Fond secondaire & Cartes (Cards / Surfaces)** : `#F8F9FA` (Gris très clair)
- **Titres principaux (Headings)** : `#111827` (Noir anthracite / Gray 900)
- **Texte courant & Paragraphes (Body)** : `#374151` (Gris foncé / Gray 700)
- **Bordures & Séparateurs (Borders / Dividers)** : `#E5E7EB` (Gris doux / Gray 200)
- **Boutons d'action (CTA / Primary Buttons)** :
  - Défaut : `#2563EB` (Bleu royal / Blue 600)
  - Survol (Hover) : `#1D4ED8` (Bleu foncé / Blue 700)
  - Texte : `#FFFFFF`
- **Boutons secondaires (Secondary Buttons)** :
  - Fond : `#FFFFFF` (Blanc)
  - Bordure & Texte : `#D1D5DB` / `#374151`
  - Survol (Hover) : `#F3F4F6` (Gris clair)
- **Liens hypertextes & Accents (Links / Accents)** :
  - Défaut : `#7C3AED` (Violet / Purple 600)
  - Survol (Hover) : `#6D28D9` (Violet sombre / Purple 700)

## Typographie Obligatoire
- **Police de caractères (Font family)** : `Poppins`, sans-serif (doit être utilisée systématiquement pour tous les textes, titres et composants).

## Règles Fondamentales d'Architecture & Comportement de l'Agent IA

1. **Police Poppins obligatoire** : Toujours utiliser la police `Poppins` pour l'ensemble des textes et de l'interface.
2. **Pas de dégradés (gradients)** : Ne pas utiliser de couleurs en dégradé / gradient dans les styles et l'interface.
3. **Pas d'émojis** : Ne jamais utiliser d'émojis, ni dans le code, ni dans les interfaces utilisateur, ni dans les messages.
4. **Commentaires minimaux** : Ne pas mettre de commentaires dans le code, à l'exception stricte des grands titres de sections.
5. **Nommage des fichiers** : Utiliser la convention `snake_case` avec le caractère `_` comme séparateur, et un maximum strict de 3 mots par nom de fichier (ex: `patients_controller.ts`, `api_router.ts`).
6. **Respect strict du périmètre** : Réaliser strictement et uniquement ce que l'utilisateur demande. Ne rien inventer ni extrapoler.
7. **Propositions & Autorisations** : Si l'IA a une suggestion ou une proposition d'amélioration, elle doit obligatoirement la soumettre à l'utilisateur et attendre son accord explicite avant toute implémentation.
8. **Séparation stricte et obligatoire Frontend / Backend** :
   - Les développeurs et agents IA doivent **TOUJOURS et SYSTÉMATIQUEMENT** séparer le Frontend et le Backend dans des dossiers distincts :
     - **Dossier `frontend/`** : Uniquement l'interface utilisateur (UI), les composants d'affichage React, les modales graphiques, les formulaires de saisie, les styles CSS et les hooks de rendu visuel.
     - **Dossier `backend/`** : Uniquement la logique métier serveur, la gestion des fiches patients, le traitement des actes de soins, les routes d'API REST (`/api/*`), les contrôleurs, la validation des données entrantes, la persistance base de données et la vérification des droits/authentification côté serveur.
     - **Fichier `server.ts`** : Point d'entrée serveur unique à la racine reliant l'API backend et montant l'application frontend.
   - Ne **JAMAIS** mélanger le code de gestion backend à l'intérieur des composants de présentation frontend.
9. **Séparation modulaire des fonctionnalités** : Toujours organiser et séparer les fonctionnalités demandées dans des dossiers dédiés et distincts (ex: routes, contrôleurs, middleware, composants, services).
10. **Fichiers non saturés** : Veiller à ce qu'aucun fichier ne soit surchargé ou trop saturé en code/logique ; découper le code en plusieurs sous-fichiers concis et ciblés dès que nécessaire.
11. **Regroupement des icônes** : Regrouper tous les composants d'icônes dans un même fichier dédié (ex: `navigation_icons.tsx`).
12. **Exécution stricte et minimale des demandes** : Faire tout simplement et strictement ce que l'utilisateur demande. Si l'utilisateur pose une question, demande une explication ou fait une simple remarque, y répondre textuellement sans modifier le code. Ne modifier aucun fichier, style, composant ou mise en page sans une instruction d'action explicite de l'utilisateur.
13. **Synchronisation Backend avec Firestore (Option 2)** :
   - Le serveur backend Node.js / Express assure systématiquement la synchronisation bidirectionnelle avec Cloud Firestore via le service dédié `firestore_sync.ts`.
   - L'API REST sous `/api/patients` interroge et persiste les fiches de patients ainsi que l'historique des soins directement dans Firestore (projet `dentia-horizon`), tout en maintenant le cache local pour la résilience.
   - Le frontend React interroge exclusivement les endpoints de l'API backend (`/api/patients`) sans effectuer d'appels directs non authentifiés vers Firestore, garantissant la cohérence des données et le respect de la séparation stricte Frontend / Backend.

