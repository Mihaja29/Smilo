import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from './firebase_app';
import { handleFirestoreError, OperationType } from './firestore_errors';
import { PatientRecord, CareHistoryItem } from '../fiches/record_id_utils';

const COLLECTION_NAME = 'patients';

// Service de gestion des fiches patients avec Firestore
export function subscribeToPatients(
  onSuccess: (patients: PatientRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const collectionRef = collection(db, COLLECTION_NAME);

  return onSnapshot(
    collectionRef,
    (snapshot) => {
      const patients: PatientRecord[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data() as Omit<PatientRecord, 'id'>;
        patients.push({
          ...data,
          id: docSnapshot.id,
        });
      });
      patients.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onSuccess(patients);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export async function savePatientToFirestore(
  patientData: Omit<PatientRecord, 'id' | 'createdAt'>
): Promise<PatientRecord> {
  const newDocRef = doc(collection(db, COLLECTION_NAME));
  const createdAt = new Date().toISOString();
  const createdBy = auth.currentUser?.uid || 'anonymous';

  const newPatient: Omit<PatientRecord, 'id'> & { createdBy: string } = {
    ...patientData,
    createdBy,
    createdAt,
  };

  try {
    await setDoc(newDocRef, newPatient);
    return {
      ...newPatient,
      id: newDocRef.id,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${COLLECTION_NAME}/${newDocRef.id}`);
  }
}

export async function updatePatientCareHistory(
  patientId: string,
  historiqueSoins: CareHistoryItem[]
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, patientId);
  try {
    await updateDoc(docRef, { historiqueSoins });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${patientId}`);
  }
}
