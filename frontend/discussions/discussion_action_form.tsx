import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
} from '../navigation/navigation_icons';
import { AiFormRequest } from '../services/discussions_api';
import { useCabinets } from '../services/cabinets_api';
import {
  createPatientApi,
  getNextIdApi,
  notifyPatientsUpdated,
} from '../services/patients_api';
import {
  createProsthesisApi,
  notifyProsthesesUpdated,
} from '../services/protheses_api';
import {
  createCoverageApi,
  notifyCoveragesUpdated,
} from '../services/coverages_api';
import {
  CoverageAssuranceOption,
  getAssurancesApi,
  getCachedAssurances,
} from '../services/assurances_api';

interface DiscussionActionFormProps {
  formRequest: AiFormRequest;
  submittedLabel?: string;
  onSubmitted: (label: string) => void;
  onDismiss: () => void;
}

const PROSTHESIS_TYPE_OPTIONS = [
  'Amovible en flexite',
  'Amovible en métalique',
  'Amovible en résine',
  'Correction empreinte',
  'Courone en résine',
  'Courone en séramique',
  'Courone en zircone',
];

function strVal(source: Record<string, unknown> | undefined, key: string): string {
  const val = source?.[key];
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  return '';
}

function listStrVal(source: Record<string, unknown> | undefined, key: string): string {
  const val = source?.[key];
  if (Array.isArray(val)) {
    return val
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .join(', ');
  }
  if (typeof val === 'string') return val.trim();
  return '';
}

function splitCommaList(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeProsthesisAmount(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/ar$/i.test(trimmed)) {
    const withoutAr = trimmed.replace(/ar$/i, '').trim();
    return withoutAr ? `${withoutAr} Ar` : 'Ar';
  }
  return `${trimmed} Ar`;
}

const INPUT_CLASS =
  'w-full min-w-0 h-8 px-2.5 rounded-lg bg-[#FFFFFF] border border-[#D1D5DB] text-[12px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#2563EB]';

const LABEL_CLASS = 'block text-[11px] font-medium text-[#374151] mb-1';

// FORMULAIRE INTERACTIF INTEGRE DANS LA BULLE DE DISCUSSION
export const DiscussionActionForm: React.FC<DiscussionActionFormProps> = ({
  formRequest,
  submittedLabel,
  onSubmitted,
  onDismiss,
}) => {
  const prefill = formRequest.prefill;
  const entityType = formRequest.entityType;
  const { cabinets } = useCabinets();
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [assurances, setAssurances] = useState<CoverageAssuranceOption[]>(() =>
    getCachedAssurances()
  );
  const [showOptional, setShowOptional] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // CHAMPS FICHE INDIVIDUELLE PATIENT
  const [nom, setNom] = useState(() => strVal(prefill, 'nom'));
  const [prenom, setPrenom] = useState(() => strVal(prefill, 'prenom'));
  const [sexe, setSexe] = useState(() => strVal(prefill, 'sexe') || 'Masculin');
  const [dateNaissance, setDateNaissance] = useState(() =>
    strVal(prefill, 'dateNaissance')
  );
  const [adresse, setAdresse] = useState(() => strVal(prefill, 'adresse'));
  const [telephone, setTelephone] = useState(() => strVal(prefill, 'telephone'));
  const [cabinet, setCabinet] = useState(() => strVal(prefill, 'cabinet'));
  const [email, setEmail] = useState(() => strVal(prefill, 'email'));
  const [profession, setProfession] = useState(() => strVal(prefill, 'profession'));
  const [assurance, setAssurance] = useState(() => strVal(prefill, 'assurance'));
  const [allergiesText, setAllergiesText] = useState(() =>
    listStrVal(prefill, 'allergies')
  );
  const [antecedentsText, setAntecedentsText] = useState(() =>
    listStrVal(prefill, 'antecedents')
  );
  const [traitementsText, setTraitementsText] = useState(() =>
    listStrVal(prefill, 'traitements')
  );
  const [grossesseText, setGrossesseText] = useState(() =>
    listStrVal(prefill, 'grossesseAllaitement')
  );

  // CHAMPS PROTHESE DENTAIRE & PRISE EN CHARGE
  const [cabinetDentaire, setCabinetDentaire] = useState(
    () => strVal(prefill, 'cabinetDentaire') || strVal(prefill, 'cabinet')
  );
  const [patientNomPrenom, setPatientNomPrenom] = useState(() =>
    strVal(prefill, 'patientNomPrenom')
  );
  const [patientContact, setPatientContact] = useState(() =>
    strVal(prefill, 'patientContact')
  );
  const [numeroDentaire, setNumeroDentaire] = useState(() =>
    strVal(prefill, 'numeroDentaire')
  );
  const [typeProthese, setTypeProthese] = useState(() =>
    strVal(prefill, 'typeProthese')
  );
  const [teinteProthese, setTeinteProthese] = useState(() =>
    strVal(prefill, 'teinteProthese')
  );
  const [nomLaboratoire, setNomLaboratoire] = useState(() =>
    strVal(prefill, 'nomLaboratoire')
  );
  const [nomCreateurProthese, setNomCreateurProthese] = useState(() =>
    strVal(prefill, 'nomCreateurProthese')
  );
  const [dateEnvoi, setDateEnvoi] = useState(
    () => strVal(prefill, 'dateEnvoi') || (entityType === 'prothese' ? todayIso : '')
  );
  const [dateLivraison, setDateLivraison] = useState(() =>
    strVal(prefill, 'dateLivraison')
  );
  const [montant, setMontant] = useState(() => strVal(prefill, 'montant'));

  const [numeroFacture, setNumeroFacture] = useState(() =>
    strVal(prefill, 'numeroFacture')
  );
  const [montantProposeAriary, setMontantProposeAriary] = useState(() =>
    strVal(prefill, 'montantProposeAriary')
  );
  const [montantAssuranceAriary, setMontantAssuranceAriary] = useState(() =>
    strVal(prefill, 'montantAssuranceAriary')
  );
  const [nomSociete, setNomSociete] = useState(() => strVal(prefill, 'nomSociete'));
  const [agence, setAgence] = useState(() => strVal(prefill, 'agence'));
  const [numeroPriseEnCharge, setNumeroPriseEnCharge] = useState(() =>
    strVal(prefill, 'numeroPriseEnCharge')
  );
  const [dateAttestation, setDateAttestation] = useState(() =>
    strVal(prefill, 'dateAttestation')
  );
  const [createursPriseEnCharge, setCreateursPriseEnCharge] = useState(() =>
    strVal(prefill, 'createursPriseEnCharge')
  );

  useEffect(() => {
    if (entityType !== 'patient') return;
    getAssurancesApi(false)
      .then((list) => setAssurances(list))
      .catch(() => {
        // Cache local conservé
      });
  }, [entityType]);

  const cabinetOptions = useMemo(() => {
    const names = cabinets.map((c) => c.name).filter(Boolean);
    const current = entityType === 'patient' ? cabinet.trim() : cabinetDentaire.trim();
    if (current && !names.some((n) => n.toLowerCase() === current.toLowerCase())) {
      return [...names, current];
    }
    return names;
  }, [cabinets, entityType, cabinet, cabinetDentaire]);

  useEffect(() => {
    if (entityType === 'patient' && !cabinet && cabinetOptions.length > 0) {
      setCabinet(cabinetOptions[0]);
    }
    if (entityType !== 'patient' && !cabinetDentaire && cabinetOptions.length > 0) {
      setCabinetDentaire(cabinetOptions[0]);
    }
  }, [entityType, cabinet, cabinetDentaire, cabinetOptions]);

  const title =
    entityType === 'patient'
      ? 'Nouvelle fiche individuelle'
      : entityType === 'prothese'
        ? 'Nouvelle prothèse dentaire'
        : 'Nouvelle prise en charge';

  const submitButtonLabel =
    entityType === 'patient'
      ? 'Enregistrer la fiche'
      : entityType === 'prothese'
        ? 'Enregistrer la prothèse'
        : 'Enregistrer la prise en charge';

  if (submittedLabel) {
    return (
      <div className="mt-2 p-2.5 rounded-xl bg-[#FFFFFF] border border-[#E5E7EB]">
        <div className="flex items-center gap-2 text-[#16A34A]">
          <span className="w-5 h-5 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] inline-flex items-center justify-center flex-shrink-0">
            <CheckIcon className="w-3 h-3" />
          </span>
          <span className="text-[12px] font-semibold text-[#111827]">
            {title} enregistrée
          </span>
        </div>
        <p className="mt-1 text-[11px] text-[#374151] break-words">
          {submittedLabel}
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorText(null);

    try {
      if (entityType === 'patient') {
        if (
          !nom.trim() ||
          !prenom.trim() ||
          !sexe.trim() ||
          !dateNaissance.trim() ||
          !adresse.trim() ||
          !telephone.trim() ||
          !cabinet.trim()
        ) {
          setErrorText('Veuillez remplir tous les champs obligatoires.');
          return;
        }
        setIsSubmitting(true);
        const identifiant = await getNextIdApi(cabinet.trim());
        const created = await createPatientApi({
          identifiant,
          nom: nom.trim(),
          prenom: prenom.trim(),
          sexe: sexe.trim(),
          dateNaissance: dateNaissance.trim(),
          adresse: adresse.trim(),
          telephone: telephone.trim(),
          email: email.trim(),
          cabinet: cabinet.trim(),
          profession: profession.trim(),
          assurance: assurance.trim(),
          allergies: splitCommaList(allergiesText),
          antecedents: splitCommaList(antecedentsText),
          traitements: splitCommaList(traitementsText),
          grossesseAllaitement:
            sexe === 'Féminin' ? splitCommaList(grossesseText) : [],
        });
        notifyPatientsUpdated();
        onSubmitted(`${created.nom} ${created.prenom} (${created.identifiant})`);
        return;
      }

      if (entityType === 'prothese') {
        if (
          !cabinetDentaire.trim() ||
          !patientNomPrenom.trim() ||
          !numeroDentaire.trim() ||
          !typeProthese.trim() ||
          !nomLaboratoire.trim() ||
          !dateEnvoi.trim() ||
          !montant.trim()
        ) {
          setErrorText('Veuillez remplir tous les champs obligatoires.');
          return;
        }
        setIsSubmitting(true);
        const created = await createProsthesisApi({
          cabinetDentaire: cabinetDentaire.trim(),
          patientNomPrenom: patientNomPrenom.trim(),
          patientContact: patientContact.trim(),
          numeroDentaire: numeroDentaire.trim(),
          typeProthese: typeProthese.trim(),
          teinteProthese: teinteProthese.trim(),
          nomLaboratoire: nomLaboratoire.trim(),
          nomCreateurProthese: nomCreateurProthese.trim(),
          dateEnvoi: dateEnvoi.trim(),
          dateLivraison: dateLivraison.trim(),
          montant: normalizeProsthesisAmount(montant),
        });
        notifyProsthesesUpdated();
        onSubmitted(`${created.patientNomPrenom} - ${created.typeProthese}`);
        return;
      }

      if (
        !cabinetDentaire.trim() ||
        !numeroFacture.trim() ||
        !montantProposeAriary.trim() ||
        !montantAssuranceAriary.trim() ||
        !patientNomPrenom.trim() ||
        !nomSociete.trim() ||
        !agence.trim() ||
        !numeroPriseEnCharge.trim()
      ) {
        setErrorText('Veuillez remplir tous les champs obligatoires.');
        return;
      }
      setIsSubmitting(true);
      const created = await createCoverageApi({
        cabinetDentaire: cabinetDentaire.trim(),
        numeroFacture: numeroFacture.trim(),
        montantProposeAriary: montantProposeAriary.trim(),
        montantAssuranceAriary: montantAssuranceAriary.trim(),
        patientNomPrenom: patientNomPrenom.trim(),
        nomSociete: nomSociete.trim(),
        agence: agence.trim(),
        numeroPriseEnCharge: numeroPriseEnCharge.trim(),
        dateAttestation: dateAttestation.trim(),
        createursPriseEnCharge: createursPriseEnCharge.trim(),
        dateEnvoi: dateEnvoi.trim(),
      });
      notifyCoveragesUpdated();
      onSubmitted(`${created.patientNomPrenom} - ${created.numeroPriseEnCharge}`);
    } catch (err) {
      setErrorText(
        err instanceof Error
          ? err.message
          : "Impossible d'enregistrer les informations."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 rounded-xl bg-[#FFFFFF] border border-[#E5E7EB] overflow-hidden font-poppins"
    >
      <div className="px-3 py-2 bg-[#F8F9FA] border-b border-[#E5E7EB] flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-[#111827] truncate">
          {title}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          disabled={isSubmitting}
          aria-label="Fermer le formulaire"
          title="Fermer"
          className="w-6 h-6 rounded-md text-[#374151] hover:bg-[#E5E7EB] inline-flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
        >
          <CloseIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-2.5">
        {entityType === 'patient' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <label className={LABEL_CLASS}>Nom *</label>
                <input
                  type="text"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Rakoto"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="min-w-0">
                <label className={LABEL_CLASS}>Prénom *</label>
                <input
                  type="text"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  placeholder="Jean"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <label className={LABEL_CLASS}>Sexe *</label>
                <select
                  value={sexe}
                  onChange={(e) => setSexe(e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="Masculin">Masculin</option>
                  <option value="Féminin">Féminin</option>
                </select>
              </div>
              <div className="min-w-0">
                <label className={LABEL_CLASS}>Date de naissance *</label>
                <input
                  type="date"
                  value={dateNaissance}
                  onChange={(e) => setDateNaissance(e.target.value)}
                  className={`${INPUT_CLASS} tabular-nums`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <label className={LABEL_CLASS}>Téléphone *</label>
                <input
                  type="tel"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  placeholder="034 00 000 00"
                  className={`${INPUT_CLASS} tabular-nums`}
                />
              </div>
              <div className="min-w-0">
                <label className={LABEL_CLASS}>Cabinet *</label>
                <select
                  value={cabinet}
                  onChange={(e) => setCabinet(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {cabinetOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="min-w-0">
              <label className={LABEL_CLASS}>Adresse *</label>
              <input
                type="text"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                placeholder="Lot..."
                className={INPUT_CLASS}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowOptional((prev) => !prev)}
              className="w-full py-1 px-2 rounded-lg bg-[#F8F9FA] border border-[#E5E7EB] text-[11px] font-medium text-[#374151] hover:bg-[#F3F4F6] flex items-center justify-between cursor-pointer"
            >
              <span>Champs facultatifs</span>
              <ChevronDownIcon
                className={`w-3.5 h-3.5 transition-transform ${
                  showOptional ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showOptional && (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <label className={LABEL_CLASS}>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nom@exemple.mg"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="min-w-0">
                    <label className={LABEL_CLASS}>Profession</label>
                    <input
                      type="text"
                      value={profession}
                      onChange={(e) => setProfession(e.target.value)}
                      placeholder="Profession"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <label className={LABEL_CLASS}>Assurance</label>
                  <input
                    type="text"
                    list="discussion-assurances-list"
                    value={assurance}
                    onChange={(e) => setAssurance(e.target.value)}
                    placeholder="Nom de l'assurance"
                    className={INPUT_CLASS}
                  />
                  <datalist id="discussion-assurances-list">
                    {assurances.map((item) => (
                      <option
                        key={item.id}
                        value={item.displayLabel || item.label}
                      />
                    ))}
                  </datalist>
                </div>

                <div className="min-w-0">
                  <label className={LABEL_CLASS}>Allergies (séparées par virgule)</label>
                  <input
                    type="text"
                    value={allergiesText}
                    onChange={(e) => setAllergiesText(e.target.value)}
                    placeholder="Pénicilline, Latex"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="min-w-0">
                  <label className={LABEL_CLASS}>Antécédents médicaux</label>
                  <input
                    type="text"
                    value={antecedentsText}
                    onChange={(e) => setAntecedentsText(e.target.value)}
                    placeholder="Diabète, HTA"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="min-w-0">
                  <label className={LABEL_CLASS}>Traitements en cours</label>
                  <input
                    type="text"
                    value={traitementsText}
                    onChange={(e) => setTraitementsText(e.target.value)}
                    placeholder="Traitements"
                    className={INPUT_CLASS}
                  />
                </div>

                {sexe === 'Féminin' && (
                  <div className="min-w-0">
                    <label className={LABEL_CLASS}>Grossesse / Allaitement</label>
                    <input
                      type="text"
                      value={grossesseText}
                      onChange={(e) => setGrossesseText(e.target.value)}
                      placeholder="Grossesse, Allaitement"
                      className={INPUT_CLASS}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {entityType === 'prothese' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <label className={LABEL_CLASS}>Cabinet dentaire *</label>
                <select
                  value={cabinetDentaire}
                  onChange={(e) => setCabinetDentaire(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {cabinetOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className={LABEL_CLASS}>Date d'envoi *</label>
                <input
                  type="date"
                  value={dateEnvoi}
                  onChange={(e) => setDateEnvoi(e.target.value)}
                  className={`${INPUT_CLASS} tabular-nums`}
                />
              </div>
            </div>

            <div className="min-w-0">
              <label className={LABEL_CLASS}>Patient (Nom & Prénom) *</label>
              <input
                type="text"
                value={patientNomPrenom}
                onChange={(e) => setPatientNomPrenom(e.target.value)}
                placeholder="Rakoto Jean"
                className={INPUT_CLASS}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <label className={LABEL_CLASS}>N° dentaire *</label>
                <input
                  type="text"
                  value={numeroDentaire}
                  onChange={(e) => setNumeroDentaire(e.target.value)}
                  placeholder="16 ou 11-21"
                  className={`${INPUT_CLASS} tabular-nums`}
                />
              </div>
              <div className="min-w-0">
                <label className={LABEL_CLASS}>Montant (Ar) *</label>
                <input
                  type="text"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  placeholder="250000"
                  className={`${INPUT_CLASS} tabular-nums`}
                />
              </div>
            </div>

            <div className="min-w-0">
              <label className={LABEL_CLASS}>Type de prothèse *</label>
              <input
                type="text"
                list="discussion-prosthesis-types"
                value={typeProthese}
                onChange={(e) => setTypeProthese(e.target.value)}
                placeholder="Courone en zircone"
                className={INPUT_CLASS}
              />
              <datalist id="discussion-prosthesis-types">
                {PROSTHESIS_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
            </div>

            <div className="min-w-0">
              <label className={LABEL_CLASS}>Laboratoire *</label>
              <input
                type="text"
                value={nomLaboratoire}
                onChange={(e) => setNomLaboratoire(e.target.value)}
                placeholder="Nom du laboratoire"
                className={INPUT_CLASS}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowOptional((prev) => !prev)}
              className="w-full py-1 px-2 rounded-lg bg-[#F8F9FA] border border-[#E5E7EB] text-[11px] font-medium text-[#374151] hover:bg-[#F3F4F6] flex items-center justify-between cursor-pointer"
            >
              <span>Champs facultatifs</span>
              <ChevronDownIcon
                className={`w-3.5 h-3.5 transition-transform ${
                  showOptional ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showOptional && (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <label className={LABEL_CLASS}>Contact patient</label>
                    <input
                      type="text"
                      value={patientContact}
                      onChange={(e) => setPatientContact(e.target.value)}
                      placeholder="034 00 000 00"
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </div>
                  <div className="min-w-0">
                    <label className={LABEL_CLASS}>Teinte</label>
                    <input
                      type="text"
                      value={teinteProthese}
                      onChange={(e) => setTeinteProthese(e.target.value)}
                      placeholder="A2"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <label className={LABEL_CLASS}>Prothésiste</label>
                    <input
                      type="text"
                      value={nomCreateurProthese}
                      onChange={(e) => setNomCreateurProthese(e.target.value)}
                      placeholder="Nom du créateur"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="min-w-0">
                    <label className={LABEL_CLASS}>Date livraison</label>
                    <input
                      type="date"
                      value={dateLivraison}
                      onChange={(e) => setDateLivraison(e.target.value)}
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {entityType === 'prise_en_charge' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <label className={LABEL_CLASS}>Cabinet dentaire *</label>
                <select
                  value={cabinetDentaire}
                  onChange={(e) => setCabinetDentaire(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {cabinetOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className={LABEL_CLASS}>N° facture *</label>
                <input
                  type="text"
                  value={numeroFacture}
                  onChange={(e) => setNumeroFacture(e.target.value)}
                  placeholder="FAC-001"
                  className={`${INPUT_CLASS} tabular-nums`}
                />
              </div>
            </div>

            <div className="min-w-0">
              <label className={LABEL_CLASS}>Patient (Nom & Prénom) *</label>
              <input
                type="text"
                value={patientNomPrenom}
                onChange={(e) => setPatientNomPrenom(e.target.value)}
                placeholder="Rakoto Jean"
                className={INPUT_CLASS}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <label className={LABEL_CLASS}>Montant proposé (Ar) *</label>
                <input
                  type="text"
                  value={montantProposeAriary}
                  onChange={(e) => setMontantProposeAriary(e.target.value)}
                  placeholder="300000"
                  className={`${INPUT_CLASS} tabular-nums`}
                />
              </div>
              <div className="min-w-0">
                <label className={LABEL_CLASS}>Montant assurance (Ar) *</label>
                <input
                  type="text"
                  value={montantAssuranceAriary}
                  onChange={(e) => setMontantAssuranceAriary(e.target.value)}
                  placeholder="240000"
                  className={`${INPUT_CLASS} tabular-nums`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <label className={LABEL_CLASS}>Société *</label>
                <input
                  type="text"
                  value={nomSociete}
                  onChange={(e) => setNomSociete(e.target.value)}
                  placeholder="Société"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="min-w-0">
                <label className={LABEL_CLASS}>Agence *</label>
                <input
                  type="text"
                  value={agence}
                  onChange={(e) => setAgence(e.target.value)}
                  placeholder="Assurance / Agence"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="min-w-0">
              <label className={LABEL_CLASS}>N° prise en charge *</label>
              <input
                type="text"
                value={numeroPriseEnCharge}
                onChange={(e) => setNumeroPriseEnCharge(e.target.value)}
                placeholder="PEC-001"
                className={`${INPUT_CLASS} tabular-nums`}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowOptional((prev) => !prev)}
              className="w-full py-1 px-2 rounded-lg bg-[#F8F9FA] border border-[#E5E7EB] text-[11px] font-medium text-[#374151] hover:bg-[#F3F4F6] flex items-center justify-between cursor-pointer"
            >
              <span>Champs facultatifs</span>
              <ChevronDownIcon
                className={`w-3.5 h-3.5 transition-transform ${
                  showOptional ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showOptional && (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <label className={LABEL_CLASS}>Date attestation</label>
                    <input
                      type="date"
                      value={dateAttestation}
                      onChange={(e) => setDateAttestation(e.target.value)}
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </div>
                  <div className="min-w-0">
                    <label className={LABEL_CLASS}>Date d'envoi</label>
                    <input
                      type="date"
                      value={dateEnvoi}
                      onChange={(e) => setDateEnvoi(e.target.value)}
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <label className={LABEL_CLASS}>Créateur(s)</label>
                  <input
                    type="text"
                    value={createursPriseEnCharge}
                    onChange={(e) => setCreateursPriseEnCharge(e.target.value)}
                    placeholder="Nom du responsable"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {errorText && (
          <p className="text-[11px] text-[#DC2626] break-words">{errorText}</p>
        )}

        <div className="pt-1 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            disabled={isSubmitting}
            className="h-8 px-3 rounded-lg bg-[#FFFFFF] border border-[#D1D5DB] text-[12px] font-medium text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50 transition-colors cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-8 px-3 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] text-[12px] font-medium disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            {isSubmitting ? 'Enregistrement...' : submitButtonLabel}
          </button>
        </div>
      </div>
    </form>
  );
};
