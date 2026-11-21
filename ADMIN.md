# Smilo - Documentation Technique & Architecture (ADMIN.md)

Ce document récapitule l'architecture technique complète de l'application Smilo, la séparation stricte entre le **Frontend** et le **Backend**, ainsi que les spécifications des routes d'API, des services et des modèles de données.

---

## 1. Vue d'ensemble de l'Architecture

L'application est structurée selon une architecture Fullstack moderne :
* **Backend** : Serveur Node.js avec Express, exposant une API RESTful typée sous `/api/*` et gérant la validation, la logique métier et la persistance des données.
* **Frontend** : Application React 19 typée en TypeScript, stylisée avec Tailwind CSS, communiquant avec le serveur via un client HTTP dédié (`src/api/patients_client.ts`).
* **Intégration Dev & Prod** : En développement, le serveur Express monte les middlewares Vite (`tsx server.ts`) sur le port 3000. En production, le serveur sert les assets statiques compilés dans `dist/`.

---

## 2. Architecture du Backend

### 2.1 Organisation des Fichiers Backend

```
├── server.ts                             # Point d'entrée serveur Express & intégration Vite
└── server/
    ├── types.ts                          # Types et interfaces TypeScript côté serveur
    ├── data/
    │   └── patients.json                 # Persistance locale sécurisée des dossiers
    ├── routes/
    │   └── patients_router.ts            # Définition des routes de l'API REST (/api/patients)
    └── services/
        └── patients_service.ts           # Logique métier, validation et persistance
```

### 2.2 Point d'entrée Serveur (`server.ts`)

* Configure le serveur Express sur le port `3000` (ou variable d'environnement `PORT`).
* Active les parseurs de requêtes JSON (`express.json()`) et URL-encodées.
* Assure la journalisation des requêtes API (`[BACKEND METHOD] /url`).
* Monte l'API REST sous le préfixe `/api/patients` et expose `/api/health`.
* Intègre Vite en mode middleware (`createViteServer`) pour le hot-reloading en développement.
* Gère les erreurs globales avec renvoi de statut HTTP et format JSON standardisé.

### 2.3 Spécifications des Endpoints de l'API REST

| Méthode | Route | Description | Paramètres / Corps |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Vérifie l'état de santé du serveur backend | Aucun |
| `GET` | `/api/patients` | Récupère la liste des dossiers patients | Query: `?search=`, `?cabinet=`, `?includeArchived=` |
| `GET` | `/api/patients/stats` | Renvoie les statistiques globales (total, par cabinet, soins) | Aucun |
| `GET` | `/api/patients/next-id/:cabinet` | Calcule le prochain identifiant unique selon le cabinet | Param: `:cabinet` (ex: `Anjanahary`) |
| `GET` | `/api/patients/:id` | Récupère une fiche patient par son identifiant unique | Param: `:id` |
| `POST` | `/api/patients` | Valide et crée une nouvelle fiche patient | Body JSON: `CreatePatientInput` |
| `PUT` | `/api/patients/:id` | Met à jour les informations d'un dossier patient | Param: `:id`, Body JSON: champs à modifier |
| `DELETE` | `/api/patients` | Supprime l'ensemble des fiches patients | Aucun |
| `DELETE` | `/api/patients/:id` | Supprime un dossier patient spécifique | Param: `:id` |
| `POST` | `/api/patients/:id/soins` | Ajoute un acte médical / soin dans l'historique | Param: `:id`, Body JSON: `{ date, actesProduitsMedicaments, observations, montant }` |
| `DELETE` | `/api/patients/:id/soins/:soinId` | Supprime un acte de soins de l'historique | Params: `:id`, `:soinId` |

### 2.4 Logique Métier & Règles de Validation (`server/services/patients_service.ts`)

* **Attribution des identifiants par cabinet** :
  * Préfixes normalisés : `Anjanahary` (`ANJ`), `Ambohitrimanjaka` (`AMB`), `Antanimena` (`ANT`).
  * Format séquentiel : `CAB-[CODE]-[NUMERO_6_CHIFFRES]` (ex: `CAB-ANJ-000001`).
  * Le serveur calcule automatiquement le prochain numéro disponible sans doublon possible.
* **Validation stricte à la création** :
  * Champs obligatoires vérifiés côté serveur : `nom`, `prenom`, `sexe`, `dateNaissance`, `adresse`, `telephone`, `cabinet`.
  * Formatage automatique : le nom de famille est normalisé en majuscules.
* **Historique des soins** :
  * Chaque acte inséré reçoit un identifiant unique serveur (`care_[timestamp]_[hash]`).
  * Mise à jour automatique de la date de modification `updatedAt`.
* **Persistance sécurisée** :
  * Données synchronisées et persistées dans `server/data/patients.json`.

---

## 3. Architecture du Frontend

### 3.1 Organisation des Fichiers Frontend (`src/`)

```
src/
├── main.tsx                              # Point de montage de l'application React
├── App.tsx                               # Structure générale et routage de l'interface
├── index.css                             # Configuration Tailwind CSS et polices (Poppins)
├── api/
│   └── patients_client.ts                # Client HTTP dédié aux échanges avec le Backend
├── fiches/
│   ├── individual_files_view.tsx         # Vue principale (liste, recherche, filtres)
│   ├── add_record_modal.tsx              # Modale d'ajout multi-étapes avec validation
│   ├── record_detail_view.tsx            # Fiche détaillée du patient et soins
│   ├── add_care_modal.tsx                # Modale d'ajout d'acte médical
│   ├── record_actions_menu.tsx           # Menu d'actions (Voir, Archiver, Supprimer)
│   ├── record_id_utils.ts                # Interfaces de données et types partagés
│   └── tag_input_field.tsx               # Composant de saisie d'étiquettes
├── navigation/
│   ├── side_nav.tsx                      # Barre latérale pour ordinateurs
│   ├── bottom_nav.tsx                    # Barre de navigation basse pour mobiles
│   ├── mobile_sub_nav.tsx                # Navigation secondaire mobile
│   ├── app_logo.tsx                      # Logo Smilo
│   └── navigation_icons.tsx              # Bibliothèque centralisée des icônes SVG
└── settings/
    └── settings_view.tsx                 # Vue des paramètres de l'application
```

### 3.2 Le Client API (`src/api/patients_client.ts`)

Le composant frontend n'effectue aucun calcul de base de données en direct. Il sollicite les méthodes asynchrones du client API :
* `getPatients(filters)` : Récupère la liste filtrée.
* `getPatient(id)` : Récupère un dossier unique.
* `getNextId(cabinet)` : Obtient l'identifiant calculé par le serveur.
* `createPatient(payload)` : Envoie la nouvelle fiche pour validation serveur.
* `updatePatient(id, updates)` : Met à jour ou archive un dossier.
* `deletePatient(id)` : Déclenche la suppression serveur.
* `addCare(patientId, care)` : Enregistre un acte de soin.
* `deleteCare(patientId, careId)` : Supprime un soin.
* `getStats()` : Récupère les compteurs d'activité calculés par le backend.

---

## 4. Scripts & Commandes du Projet (`package.json`)

| Commande | Commande Shell | Action |
| :--- | :--- | :--- |
| `npm run dev` | `tsx server.ts` | Démarre le serveur backend Fullstack avec rechargement à chaud Vite sur le port 3000 |
| `npm run build` | `vite build` | Compile les fichiers statiques de production du Frontend dans `dist/` |
| `npm run start` | `node server.ts` | Démarre le serveur Node.js en mode production |
| `npm run lint` | `tsc --noEmit` | Vérifie le typage strict TypeScript sans émettre de fichier |
| `npm run preview` | `vite preview` | Prévisualise la version de production |
| `npm run clean` | `rm -rf dist server.js` | Nettoie les artefacts de compilation |

---

## 5. Charte Graphique & Typographie

* **Police principale** : `Poppins`, sans-serif (chargée via Google Fonts).
* **Couleurs dominantes** :
  * Fond principal : `#FFFFFF`
  * Cartes et surfaces : `#F8F9FA`
  * Titres et textes sombres : `#111827`
  * Texte courant : `#374151`
  * Bordures et séparateurs : `#E5E7EB`
  * Boutons d'action primaire : `#2563EB` (au survol `#1D4ED8`)
  * Boutons secondaires : `#FFFFFF` avec bordure `#D1D5DB`
