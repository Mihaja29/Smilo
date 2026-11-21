import { AiCreatedEntity, AiEntityType, AiFormRequest } from '../types';
import { AssurancesService } from './assurances_service';
import { CabinetsService } from './cabinets_service';
import { CoveragesService } from './coverages_service';
import { PatientsService } from './patients_service';
import { ProthesesService } from './protheses_service';

export interface AiToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AiToolExecutionOutcome {
  ok: boolean;
  result: Record<string, unknown>;
  createdEntity?: AiCreatedEntity;
  formRequest?: AiFormRequest;
}

// OUTILS DE CREATION DISPONIBLES POUR DIANA
export const AI_CREATION_TOOLS: AiToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'create_patient_record',
      description:
        "Crée une nouvelle fiche individuelle de patient dans Smilo et la synchronise dans Firestore. N'appeler cet outil que lorsque tous les champs obligatoires (nom, prenom, sexe, dateNaissance, adresse, telephone, cabinet) ont été fournis par l'utilisateur ou extraits d'une image.",
      parameters: {
        type: 'object',
        properties: {
          nom: { type: 'string', description: 'Nom de famille du patient' },
          prenom: { type: 'string', description: 'Prénom du patient' },
          sexe: {
            type: 'string',
            enum: ['Masculin', 'Féminin'],
            description: "Sexe du patient ('Masculin' ou 'Féminin')",
          },
          dateNaissance: {
            type: 'string',
            description: 'Date de naissance (format YYYY-MM-DD recommandé)',
          },
          adresse: { type: 'string', description: 'Adresse postale du patient' },
          telephone: { type: 'string', description: 'Numéro de téléphone du patient' },
          cabinet: {
            type: 'string',
            description: 'Nom exact du cabinet dentaire de rattachement',
          },
          email: { type: 'string', description: 'Adresse email (facultatif)' },
          profession: { type: 'string', description: 'Profession (facultatif)' },
          assurance: { type: 'string', description: "Nom de l'assurance (facultatif)" },
          allergies: {
            type: 'array',
            items: { type: 'string' },
            description: 'Liste des allergies (facultatif)',
          },
          antecedents: {
            type: 'array',
            items: { type: 'string' },
            description: 'Liste des antécédents médicaux (facultatif)',
          },
          traitements: {
            type: 'array',
            items: { type: 'string' },
            description: 'Liste des traitements en cours (facultatif)',
          },
          grossesseAllaitement: {
            type: 'array',
            items: { type: 'string' },
            description: 'Grossesse ou allaitement si sexe Féminin (facultatif)',
          },
        },
        required: [
          'nom',
          'prenom',
          'sexe',
          'dateNaissance',
          'adresse',
          'telephone',
          'cabinet',
        ],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_prosthesis_record',
      description:
        "Crée un nouveau dossier de prothèse dentaire dans Smilo et le synchronise dans Firestore. N'appeler cet outil que lorsque les champs obligatoires (cabinetDentaire, patientNomPrenom, numeroDentaire, typeProthese, nomLaboratoire, montant) sont connus.",
      parameters: {
        type: 'object',
        properties: {
          cabinetDentaire: { type: 'string', description: 'Nom du cabinet dentaire' },
          patientNomPrenom: { type: 'string', description: 'Nom et prénom du patient' },
          patientContact: { type: 'string', description: 'Téléphone ou contact patient (facultatif)' },
          numeroDentaire: { type: 'string', description: 'Numéro(s) de dent (ex: 16, 11-21)' },
          typeProthese: { type: 'string', description: 'Type de prothèse dentaire' },
          teinteProthese: { type: 'string', description: 'Teinte de la prothèse (facultatif, ex: A2)' },
          nomLaboratoire: { type: 'string', description: 'Nom du laboratoire prothétique' },
          nomCreateurProthese: { type: 'string', description: 'Nom du prothésiste (facultatif)' },
          dateEnvoi: {
            type: 'string',
            description: "Date d'envoi au laboratoire au format YYYY-MM-DD (défaut: date du jour)",
          },
          dateLivraison: {
            type: 'string',
            description: 'Date de livraison prévue YYYY-MM-DD (facultatif)',
          },
          montant: { type: 'string', description: 'Montant de la prothèse (ex: 250000 Ar)' },
          etatTraitement: {
            type: 'string',
            enum: ['En cours', 'Terminer'],
            description: "État de traitement ('En cours' par défaut ou 'Terminer')",
          },
        },
        required: [
          'cabinetDentaire',
          'patientNomPrenom',
          'numeroDentaire',
          'typeProthese',
          'nomLaboratoire',
          'montant',
        ],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_coverage_record',
      description:
        "Crée une nouvelle prise en charge d'assurance dans Smilo et la synchronise dans Firestore. N'appeler cet outil que lorsque les champs obligatoires (cabinetDentaire, numeroFacture, montantProposeAriary, montantAssuranceAriary, patientNomPrenom, nomSociete, agence, numeroPriseEnCharge) sont connus.",
      parameters: {
        type: 'object',
        properties: {
          cabinetDentaire: { type: 'string', description: 'Nom du cabinet dentaire prestataire' },
          numeroFacture: { type: 'string', description: 'Numéro unique de facture' },
          montantProposeAriary: {
            type: 'string',
            description: 'Montant proposé en Ariary (chiffres uniquement, ex: 300000)',
          },
          montantAssuranceAriary: {
            type: 'string',
            description: "Montant accordé par l'assurance en Ariary (chiffres uniquement, ex: 240000)",
          },
          patientNomPrenom: { type: 'string', description: 'Nom et prénom du patient' },
          nomSociete: { type: 'string', description: 'Nom de la société du patient' },
          agence: { type: 'string', description: "Agence ou organisme d'assurance" },
          numeroPriseEnCharge: { type: 'string', description: 'Numéro de prise en charge' },
          dateAttestation: {
            type: 'string',
            description: "Date d'attestation YYYY-MM-DD (facultatif)",
          },
          createursPriseEnCharge: {
            type: 'string',
            description: 'Créateur(s) de la prise en charge (facultatif)',
          },
          dateEnvoi: {
            type: 'string',
            description: "Date d'envoi YYYY-MM-DD (facultatif)",
          },
        },
        required: [
          'cabinetDentaire',
          'numeroFacture',
          'montantProposeAriary',
          'montantAssuranceAriary',
          'patientNomPrenom',
          'nomSociete',
          'agence',
          'numeroPriseEnCharge',
        ],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_record_form',
      description:
        "Affiche un formulaire interactif directement dans la bulle de discussion pour que l'utilisateur saisisse ou complète les informations manquantes d'une fiche individuelle ('patient'), d'une prothèse dentaire ('prothese') ou d'une prise en charge ('prise_en_charge'). À appeler obligatoirement dès qu'il manque au moins un champ requis ou lorsque l'utilisateur demande un formulaire de saisie, au lieu d'énumérer les champs en texte.",
      parameters: {
        type: 'object',
        properties: {
          entityType: {
            type: 'string',
            enum: ['patient', 'prothese', 'prise_en_charge'],
            description:
              "Type de dossier à créer : 'patient' (fiche individuelle), 'prothese' (prothèse dentaire) ou 'prise_en_charge' (prise en charge assurance).",
          },
          prefill: {
            type: 'object',
            description:
              "Valeurs partielles déjà connues (nom, prenom, sexe, dateNaissance, adresse, telephone, cabinet, email, profession, assurance, allergies, antecedents, traitements, grossesseAllaitement, cabinetDentaire, patientNomPrenom, patientContact, numeroDentaire, typeProthese, teinteProthese, nomLaboratoire, nomCreateurProthese, dateEnvoi, dateLivraison, montant, numeroFacture, montantProposeAriary, montantAssuranceAriary, nomSociete, agence, numeroPriseEnCharge, dateAttestation, createursPriseEnCharge).",
          },
        },
        required: ['entityType'],
      },
    },
  },
];

// NORMALISATION ET CONTEXTE METIER
function normalizePlainText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function normalizeSearchKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeSexe(value: unknown): string {
  const key = normalizeSearchKey(normalizePlainText(value));
  if (key === 'masculin' || key === 'm' || key === 'homme' || key === 'garcon') {
    return 'Masculin';
  }
  if (key === 'feminin' || key === 'f' || key === 'femme' || key === 'fille') {
    return 'Féminin';
  }
  return '';
}

function normalizeIsoDate(value: unknown): string {
  const raw = normalizePlainText(value);
  if (!raw) return '';
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return raw.slice(0, 20);
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizePlainText(entry))
      .filter(Boolean)
      .slice(0, 50);
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[,;\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 50);
  }
  return [];
}

function normalizeNumericAmount(value: unknown): string {
  const raw = normalizePlainText(value);
  if (!raw) return '';
  const cleaned = raw
    .replace(/\b(ariary|ar)\b/gi, '')
    .replace(/\s+/g, '')
    .replace(/,/g, '.');
  return cleaned;
}

function normalizeProsthesisAmount(value: unknown): string {
  const raw = normalizePlainText(value);
  if (!raw) return '';
  if (/^\d[\d\s.,]*$/.test(raw)) {
    return `${raw.replace(/\s+/g, ' ').trim()} Ar`.slice(0, 50);
  }
  return raw.slice(0, 50);
}

async function resolveCabinetName(rawCabinet: unknown): Promise<{
  resolved?: string;
  availableNames: string[];
}> {
  const cabinets = await CabinetsService.getAllCabinets().catch(() => []);
  const availableNames = cabinets.map((c) => c.name);
  const inputKey = normalizeSearchKey(normalizePlainText(rawCabinet));

  if (!inputKey) {
    return { availableNames };
  }

  const exact = cabinets.find(
    (c) =>
      normalizeSearchKey(c.name) === inputKey ||
      (c.code && normalizeSearchKey(c.code) === inputKey)
  );
  if (exact) {
    return { resolved: exact.name, availableNames };
  }

  const partial = cabinets.find((c) => normalizeSearchKey(c.name).includes(inputKey));
  if (partial) {
    return { resolved: partial.name, availableNames };
  }

  return { resolved: normalizePlainText(rawCabinet).slice(0, 100), availableNames };
}

function withTimeoutFallback<T>(promise: Promise<T>, fallback: T, timeoutMs = 2500): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

export async function buildAiWorkspaceContext(): Promise<string> {
  const [cabinets, assurances] = await Promise.all([
    withTimeoutFallback(CabinetsService.getAllCabinets(), []),
    withTimeoutFallback(AssurancesService.getAllAssurances(false), []),
  ]);
  const cabinetNames = cabinets.map((c) => c.name).filter(Boolean);
  const assuranceNames = assurances.map((a) => a.displayLabel || a.label).filter(Boolean);
  const todayIso = new Date().toISOString().slice(0, 10);

  return [
    `Date du jour : ${todayIso}`,
    `Cabinets dentaires actifs : ${cabinetNames.length > 0 ? cabinetNames.join(', ') : 'Anjanahary, Ambohitrimanjaka, Antanimena'}`,
    `Assurances enregistrées : ${assuranceNames.length > 0 ? assuranceNames.join(', ') : 'Aucune'}`,
  ].join('\n');
}

function normalizeEntityType(value: unknown): AiEntityType | null {
  const key = normalizeSearchKey(normalizePlainText(value));
  if (key === 'patient' || key === 'fiche' || key === 'fiche_individuelle' || key === 'fiche individuelle') {
    return 'patient';
  }
  if (key === 'prothese' || key === 'prothese dentaire' || key === 'prothese_dentaire') {
    return 'prothese';
  }
  if (
    key === 'prise_en_charge' ||
    key === 'prise en charge' ||
    key === 'coverage' ||
    key === 'assurance'
  ) {
    return 'prise_en_charge';
  }
  return null;
}

async function sanitizeFormPrefill(
  entityType: AiEntityType,
  rawPrefill: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const prefill: Record<string, unknown> = {};

  if (entityType === 'patient') {
    const nom = normalizePlainText(rawPrefill.nom).slice(0, 100);
    const prenom = normalizePlainText(rawPrefill.prenom).slice(0, 100);
    const sexe = normalizeSexe(rawPrefill.sexe);
    const dateNaissance = normalizeIsoDate(rawPrefill.dateNaissance);
    const adresse = normalizePlainText(rawPrefill.adresse).slice(0, 255);
    const telephone = normalizePlainText(rawPrefill.telephone).slice(0, 30);
    const email = normalizePlainText(rawPrefill.email).slice(0, 100);
    const profession = normalizePlainText(rawPrefill.profession).slice(0, 100);
    const assurance = normalizePlainText(rawPrefill.assurance).slice(0, 100);
    const allergies = normalizeStringList(rawPrefill.allergies);
    const antecedents = normalizeStringList(rawPrefill.antecedents);
    const traitements = normalizeStringList(rawPrefill.traitements);
    const grossesseAllaitement =
      sexe === 'Féminin' ? normalizeStringList(rawPrefill.grossesseAllaitement) : [];
    const { resolved: cabinet } = await resolveCabinetName(
      rawPrefill.cabinet ?? rawPrefill.cabinetDentaire
    );

    if (nom) prefill.nom = nom;
    if (prenom) prefill.prenom = prenom;
    if (sexe) prefill.sexe = sexe;
    if (dateNaissance) prefill.dateNaissance = dateNaissance;
    if (adresse) prefill.adresse = adresse;
    if (telephone) prefill.telephone = telephone;
    if (cabinet) prefill.cabinet = cabinet;
    if (email) prefill.email = email;
    if (profession) prefill.profession = profession;
    if (assurance) prefill.assurance = assurance;
    if (allergies.length > 0) prefill.allergies = allergies;
    if (antecedents.length > 0) prefill.antecedents = antecedents;
    if (traitements.length > 0) prefill.traitements = traitements;
    if (grossesseAllaitement.length > 0) prefill.grossesseAllaitement = grossesseAllaitement;
    return prefill;
  }

  if (entityType === 'prothese') {
    const { resolved: cabinetDentaire } = await resolveCabinetName(
      rawPrefill.cabinetDentaire ?? rawPrefill.cabinet
    );
    const patientNomPrenom = normalizePlainText(rawPrefill.patientNomPrenom).slice(0, 200);
    const patientContact = normalizePlainText(rawPrefill.patientContact).slice(0, 100);
    const numeroDentaire = normalizePlainText(rawPrefill.numeroDentaire).slice(0, 100);
    const typeProthese = normalizePlainText(rawPrefill.typeProthese).slice(0, 150);
    const teinteProthese = normalizePlainText(rawPrefill.teinteProthese).slice(0, 50);
    const nomLaboratoire = normalizePlainText(rawPrefill.nomLaboratoire).slice(0, 150);
    const nomCreateurProthese = normalizePlainText(rawPrefill.nomCreateurProthese).slice(0, 150);
    const dateEnvoi = normalizeIsoDate(rawPrefill.dateEnvoi);
    const dateLivraison = normalizeIsoDate(rawPrefill.dateLivraison);
    const montant = normalizeNumericAmount(rawPrefill.montant).slice(0, 50);

    if (cabinetDentaire) prefill.cabinetDentaire = cabinetDentaire;
    if (patientNomPrenom) prefill.patientNomPrenom = patientNomPrenom;
    if (patientContact) prefill.patientContact = patientContact;
    if (numeroDentaire) prefill.numeroDentaire = numeroDentaire;
    if (typeProthese) prefill.typeProthese = typeProthese;
    if (teinteProthese) prefill.teinteProthese = teinteProthese;
    if (nomLaboratoire) prefill.nomLaboratoire = nomLaboratoire;
    if (nomCreateurProthese) prefill.nomCreateurProthese = nomCreateurProthese;
    if (dateEnvoi) prefill.dateEnvoi = dateEnvoi;
    if (dateLivraison) prefill.dateLivraison = dateLivraison;
    if (montant) prefill.montant = montant;
    return prefill;
  }

  const { resolved: cabinetDentaire } = await resolveCabinetName(
    rawPrefill.cabinetDentaire ?? rawPrefill.cabinet
  );
  const numeroFacture = normalizePlainText(rawPrefill.numeroFacture).slice(0, 100);
  const montantProposeAriary = normalizeNumericAmount(rawPrefill.montantProposeAriary).slice(0, 40);
  const montantAssuranceAriary = normalizeNumericAmount(rawPrefill.montantAssuranceAriary).slice(
    0,
    40
  );
  const patientNomPrenom = normalizePlainText(rawPrefill.patientNomPrenom).slice(0, 200);
  const nomSociete = normalizePlainText(rawPrefill.nomSociete).slice(0, 150);
  const agence = normalizePlainText(rawPrefill.agence).slice(0, 120);
  const numeroPriseEnCharge = normalizePlainText(rawPrefill.numeroPriseEnCharge).slice(0, 100);
  const dateAttestation = normalizeIsoDate(rawPrefill.dateAttestation);
  const createursPriseEnCharge = normalizePlainText(rawPrefill.createursPriseEnCharge).slice(0, 200);
  const dateEnvoi = normalizeIsoDate(rawPrefill.dateEnvoi);

  if (cabinetDentaire) prefill.cabinetDentaire = cabinetDentaire;
  if (numeroFacture) prefill.numeroFacture = numeroFacture;
  if (montantProposeAriary) prefill.montantProposeAriary = montantProposeAriary;
  if (montantAssuranceAriary) prefill.montantAssuranceAriary = montantAssuranceAriary;
  if (patientNomPrenom) prefill.patientNomPrenom = patientNomPrenom;
  if (nomSociete) prefill.nomSociete = nomSociete;
  if (agence) prefill.agence = agence;
  if (numeroPriseEnCharge) prefill.numeroPriseEnCharge = numeroPriseEnCharge;
  if (dateAttestation) prefill.dateAttestation = dateAttestation;
  if (createursPriseEnCharge) prefill.createursPriseEnCharge = createursPriseEnCharge;
  if (dateEnvoi) prefill.dateEnvoi = dateEnvoi;
  return prefill;
}

// EXECUTION DES ACTIONS DE CREATION
export async function executeAiToolCall(
  name: string,
  rawArgs: unknown
): Promise<AiToolExecutionOutcome> {
  const args =
    rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
      ? (rawArgs as Record<string, unknown>)
      : {};

  try {
    if (name === 'request_record_form') {
      const entityType = normalizeEntityType(args.entityType);
      if (!entityType) {
        return {
          ok: false,
          result: {
            error: "entityType doit être 'patient', 'prothese' ou 'prise_en_charge'.",
          },
        };
      }
      const nestedPrefill =
        args.prefill && typeof args.prefill === 'object' && !Array.isArray(args.prefill)
          ? (args.prefill as Record<string, unknown>)
          : {};
      const mergedRaw: Record<string, unknown> = { ...args, ...nestedPrefill };
      delete mergedRaw.entityType;
      delete mergedRaw.prefill;
      const prefill = await sanitizeFormPrefill(entityType, mergedRaw);
      const formRequest: AiFormRequest = { entityType, prefill };
      return {
        ok: true,
        result: {
          displayed: true,
          entityType,
          prefill,
          instruction:
            "Le formulaire interactif va s'afficher sous ta réponse. Réponds en une seule phrase courte sans lister les champs du formulaire.",
        },
        formRequest,
      };
    }

    if (name === 'create_patient_record') {
      const sexe = normalizeSexe(args.sexe);
      if (!sexe) {
        return {
          ok: false,
          result: { error: "Le sexe du patient doit être 'Masculin' ou 'Féminin'." },
        };
      }

      const { resolved: resolvedCabinet, availableNames } = await resolveCabinetName(
        args.cabinet
      );
      if (!resolvedCabinet) {
        return {
          ok: false,
          result: {
            error: `Le cabinet est obligatoire. Cabinets disponibles : ${availableNames.join(', ')}`,
          },
        };
      }

      const created = await PatientsService.createPatient({
        nom: normalizePlainText(args.nom).slice(0, 100),
        prenom: normalizePlainText(args.prenom).slice(0, 100),
        sexe,
        dateNaissance: normalizeIsoDate(args.dateNaissance),
        adresse: normalizePlainText(args.adresse).slice(0, 255),
        telephone: normalizePlainText(args.telephone).slice(0, 30),
        email: normalizePlainText(args.email).slice(0, 100),
        cabinet: resolvedCabinet,
        profession: normalizePlainText(args.profession).slice(0, 100),
        assurance: normalizePlainText(args.assurance).slice(0, 100),
        allergies: normalizeStringList(args.allergies),
        antecedents: normalizeStringList(args.antecedents),
        traitements: normalizeStringList(args.traitements),
        grossesseAllaitement:
          sexe === 'Féminin' ? normalizeStringList(args.grossesseAllaitement) : [],
      });

      return {
        ok: true,
        result: {
          id: created.id,
          identifiant: created.identifiant,
          nom: created.nom,
          prenom: created.prenom,
          sexe: created.sexe,
          dateNaissance: created.dateNaissance,
          telephone: created.telephone,
          cabinet: created.cabinet,
        },
        createdEntity: {
          type: 'patient',
          id: created.id,
          label: `${created.nom} ${created.prenom} (${created.identifiant})`,
        },
      };
    }

    if (name === 'create_prosthesis_record') {
      const { resolved: resolvedCabinet, availableNames } = await resolveCabinetName(
        args.cabinetDentaire
      );
      if (!resolvedCabinet) {
        return {
          ok: false,
          result: {
            error: `Le cabinet dentaire est obligatoire. Cabinets disponibles : ${availableNames.join(', ')}`,
          },
        };
      }

      const patientNomPrenom = normalizePlainText(args.patientNomPrenom).slice(0, 200);
      let patientContact = normalizePlainText(args.patientContact).slice(0, 100);

      if (!patientContact && patientNomPrenom) {
        const patients = await PatientsService.getAllPatients({ inTrash: false }).catch(
          () => []
        );
        const searchKey = normalizeSearchKey(patientNomPrenom);
        const matches = patients.filter((p) => {
          const fullA = normalizeSearchKey(`${p.nom} ${p.prenom}`);
          const fullB = normalizeSearchKey(`${p.prenom} ${p.nom}`);
          return fullA === searchKey || fullB === searchKey;
        });
        if (matches.length === 1 && matches[0].telephone) {
          patientContact = matches[0].telephone.slice(0, 100);
        }
      }

      const todayIso = new Date().toISOString().slice(0, 10);
      const dateEnvoi = normalizeIsoDate(args.dateEnvoi) || todayIso;
      const dateLivraison = normalizeIsoDate(args.dateLivraison);
      const etatTraitement =
        normalizeSearchKey(normalizePlainText(args.etatTraitement)) === 'terminer'
          ? 'Terminer'
          : 'En cours';

      const created = await ProthesesService.createProthesis({
        cabinetDentaire: resolvedCabinet,
        patientNomPrenom,
        patientContact,
        numeroDentaire: normalizePlainText(args.numeroDentaire).slice(0, 100),
        typeProthese: normalizePlainText(args.typeProthese).slice(0, 150),
        teinteProthese: normalizePlainText(args.teinteProthese).slice(0, 50),
        nomLaboratoire: normalizePlainText(args.nomLaboratoire).slice(0, 150),
        nomCreateurProthese: normalizePlainText(args.nomCreateurProthese).slice(0, 150),
        dateEnvoi,
        dateLivraison,
        montant: normalizeProsthesisAmount(args.montant),
        etatTraitement,
      });

      return {
        ok: true,
        result: {
          id: created.id,
          cabinetDentaire: created.cabinetDentaire,
          patientNomPrenom: created.patientNomPrenom,
          numeroDentaire: created.numeroDentaire,
          typeProthese: created.typeProthese,
          nomLaboratoire: created.nomLaboratoire,
          dateEnvoi: created.dateEnvoi,
          montant: created.montant,
          etatTraitement: created.etatTraitement,
        },
        createdEntity: {
          type: 'prothese',
          id: created.id,
          label: `${created.patientNomPrenom} - ${created.typeProthese}`,
        },
      };
    }

    if (name === 'create_coverage_record') {
      const { resolved: resolvedCabinet, availableNames } = await resolveCabinetName(
        args.cabinetDentaire
      );
      if (!resolvedCabinet) {
        return {
          ok: false,
          result: {
            error: `Le cabinet dentaire est obligatoire. Cabinets disponibles : ${availableNames.join(', ')}`,
          },
        };
      }

      const created = await CoveragesService.createCoverage({
        cabinetDentaire: resolvedCabinet,
        numeroFacture: normalizePlainText(args.numeroFacture).slice(0, 100),
        montantProposeAriary: normalizeNumericAmount(args.montantProposeAriary).slice(0, 40),
        montantAssuranceAriary: normalizeNumericAmount(args.montantAssuranceAriary).slice(0, 40),
        patientNomPrenom: normalizePlainText(args.patientNomPrenom).slice(0, 200),
        nomSociete: normalizePlainText(args.nomSociete).slice(0, 150),
        agence: normalizePlainText(args.agence).slice(0, 120),
        numeroPriseEnCharge: normalizePlainText(args.numeroPriseEnCharge).slice(0, 100),
        dateAttestation: normalizeIsoDate(args.dateAttestation),
        createursPriseEnCharge: normalizePlainText(args.createursPriseEnCharge).slice(0, 200),
        dateEnvoi: normalizeIsoDate(args.dateEnvoi),
      });

      return {
        ok: true,
        result: {
          id: created.id,
          cabinetDentaire: created.cabinetDentaire,
          numeroFacture: created.numeroFacture,
          numeroPriseEnCharge: created.numeroPriseEnCharge,
          patientNomPrenom: created.patientNomPrenom,
          nomSociete: created.nomSociete,
          agence: created.agence,
          montantProposeAriary: created.montantProposeAriary,
          montantAssuranceAriary: created.montantAssuranceAriary,
        },
        createdEntity: {
          type: 'prise_en_charge',
          id: created.id,
          label: `${created.patientNomPrenom} - ${created.numeroPriseEnCharge}`,
        },
      };
    }

    return {
      ok: false,
      result: { error: `Action inconnue : ${name}` },
    };
  } catch (error) {
    return {
      ok: false,
      result: {
        error: error instanceof Error ? error.message : "Erreur lors de la création de l'enregistrement.",
      },
    };
  }
}

export function extractFallbackActions(text: string): {
  cleanText: string;
  actions: Array<{ name: string; arguments: Record<string, unknown> }>;
} {
  const actions: Array<{ name: string; arguments: Record<string, unknown> }> = [];
  const cleanText = text
    .replace(/<SMILO_ACTION>\s*([\s\S]*?)\s*<\/SMILO_ACTION>/g, (_full, rawJson: string) => {
      try {
        const parsed = JSON.parse(rawJson.trim()) as {
          name?: unknown;
          arguments?: unknown;
        };
        if (typeof parsed?.name === 'string') {
          actions.push({
            name: parsed.name,
            arguments:
              parsed.arguments && typeof parsed.arguments === 'object' && !Array.isArray(parsed.arguments)
                ? (parsed.arguments as Record<string, unknown>)
                : {},
          });
        }
      } catch {
        // Ignorer bloc JSON malforme
      }
      return '';
    })
    .trim();

  return { cleanText, actions };
}
