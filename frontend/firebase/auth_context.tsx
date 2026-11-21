import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider, testFirestoreConnection } from './firebase_app';

interface UserProfileOverrides {
  displayName?: string;
  phoneNumber?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isDemoUser: boolean;
  isAuthenticated: boolean;
  needsEmailVerification: boolean;
  authError: string | null;
  authNotice: string | null;
  profilePhoneNumber: string;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationStatus: () => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<void>;
  signInAsDemo: (customName?: string, customEmail?: string) => void;
  signOutUser: () => Promise<void>;
  updateUserProfile: (updates: UserProfileOverrides) => Promise<void>;
  clearAuthError: () => void;
  clearAuthNotice: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isDemoUser: false,
  isAuthenticated: false,
  needsEmailVerification: false,
  authError: null,
  authNotice: null,
  profilePhoneNumber: '',
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  registerWithEmail: async () => {},
  resendVerificationEmail: async () => {},
  refreshVerificationStatus: async () => false,
  sendPasswordReset: async () => {},
  signInAsDemo: () => {},
  signOutUser: async () => {},
  updateUserProfile: async () => {},
  clearAuthError: () => {},
  clearAuthNotice: () => {},
});

const DEMO_STORAGE_KEY = 'smilo_demo_user';
const PROFILE_STORAGE_PREFIX = 'smilo_user_profile_';

function mapFirebaseAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Cette adresse e-mail est déjà associée à un compte.';
    case 'auth/invalid-email':
      return 'Veuillez saisir une adresse e-mail valide.';
    case 'auth/weak-password':
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Adresse e-mail ou mot de passe incorrect.';
    case 'auth/user-disabled':
      return 'Ce compte utilisateur a été désactivé.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Veuillez patienter quelques instants avant de réessayer.';
    case 'auth/operation-not-allowed':
      return "L'authentification par e-mail et mot de passe n'est pas encore activée dans Firebase Console.";
    case 'auth/network-request-failed':
      return 'Erreur réseau. Vérifiez votre connexion Internet puis réessayez.';
    default:
      return 'Authentification impossible. Veuillez vérifier vos informations et réessayer.';
  }
}

function getVerificationActionSettings() {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return {
    url: window.location.origin,
    handleCodeInApp: false,
  };
}

function loadProfileOverrides(uid?: string): UserProfileOverrides {
  if (!uid) return {};
  try {
    const raw = localStorage.getItem(`${PROFILE_STORAGE_PREFIX}${uid}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as UserProfileOverrides;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveProfileOverrides(uid: string, overrides: UserProfileOverrides): void {
  try {
    localStorage.setItem(`${PROFILE_STORAGE_PREFIX}${uid}`, JSON.stringify(overrides));
  } catch {
    // ignore
  }
}

function createMockUser(name = 'Dr. Mathieu Andrianarivelo', email = 'mathieu.dr@smilo.mg'): User {
  return {
    uid: 'demo-practitioner-mathieu',
    displayName: name,
    email: email,
    photoURL: null,
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    refreshToken: '',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => 'demo-token',
    getIdTokenResult: async () => ({
      token: 'demo-token',
      authTime: 'now',
      issuedAtTime: 'now',
      expirationTime: 'later',
      signInProvider: 'password',
      signInSecondFactor: null,
      claims: {},
    }),
    reload: async () => {},
    toJSON: () => ({}),
    phoneNumber: '',
    providerId: 'demo',
  } as unknown as User;
}

function safeGetStorage(key: string): string | null {
  try {
    return typeof window !== 'undefined' && window.sessionStorage ? sessionStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
}

function safeRemoveStorage(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

// Fournisseur d'authentification Firebase & Validation e-mail
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedDemo = safeGetStorage(DEMO_STORAGE_KEY);
      if (savedDemo) {
        const parsed = JSON.parse(savedDemo);
        const overrides = loadProfileOverrides('demo-practitioner-mathieu');
        return createMockUser(overrides.displayName || parsed.name, parsed.email);
      }
    } catch {
      // ignore
    }
    return null;
  });
  const [isDemoUser, setIsDemoUser] = useState<boolean>(() => {
    return Boolean(safeGetStorage(DEMO_STORAGE_KEY));
  });
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [profilePhoneNumber, setProfilePhoneNumber] = useState<string>(() => {
    const savedDemo = safeGetStorage(DEMO_STORAGE_KEY);
    if (savedDemo) {
      return loadProfileOverrides('demo-practitioner-mathieu').phoneNumber || '';
    }
    return '';
  });
  const [, setProfileRevision] = useState(0);

  const needsEmailVerification = Boolean(user && !isDemoUser && !user.emailVerified);
  const isAuthenticated = Boolean(user && (isDemoUser || user.emailVerified));

  useEffect(() => {
    try {
      testFirestoreConnection();
    } catch {
      // ignore
    }

    if (safeGetStorage(DEMO_STORAGE_KEY)) {
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      setLoading(false);
    }, 1200);

    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(
        auth,
        (currentUser) => {
          clearTimeout(timer);
          if (currentUser) {
            const overrides = loadProfileOverrides(currentUser.uid);
            setUser(currentUser);
            setProfilePhoneNumber(
              overrides.phoneNumber !== undefined
                ? overrides.phoneNumber
                : currentUser.phoneNumber || ''
            );
            setIsDemoUser(false);
            safeRemoveStorage(DEMO_STORAGE_KEY);
          } else if (!safeGetStorage(DEMO_STORAGE_KEY)) {
            setUser(null);
            setProfilePhoneNumber('');
          }
          setLoading(false);
        },
        (error) => {
          console.warn('Erreur auth state:', error);
          clearTimeout(timer);
          setLoading(false);
        }
      );
    } catch (err) {
      console.warn('Erreur initialisation auth:', err);
      clearTimeout(timer);
      setLoading(false);
    }

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!needsEmailVerification || !auth.currentUser) {
      return;
    }

    const checkVerificationOnFocus = async () => {
      if (!auth.currentUser) return;
      try {
        await reload(auth.currentUser);
        if (auth.currentUser.emailVerified) {
          await auth.currentUser.getIdToken(true);
          setUser(auth.currentUser);
          setAuthError(null);
          setAuthNotice(null);
          setProfileRevision((prev) => prev + 1);
        }
      } catch {
        // Verification silencieuse au retour sur l'onglet
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkVerificationOnFocus();
      }
    };

    window.addEventListener('focus', checkVerificationOnFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', checkVerificationOnFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [needsEmailVerification]);

  const signInAsDemo = (customName?: string, customEmail?: string) => {
    const overrides = loadProfileOverrides('demo-practitioner-mathieu');
    const demoUser = createMockUser(
      overrides.displayName || customName || 'Dr. Mathieu Andrianarivelo',
      customEmail || 'mathieu.dr@smilo.mg'
    );
    safeSetStorage(
      DEMO_STORAGE_KEY,
      JSON.stringify({ name: demoUser.displayName, email: demoUser.email })
    );
    setUser(demoUser);
    setProfilePhoneNumber(overrides.phoneNumber || '');
    setIsDemoUser(true);
    setAuthError(null);
    setAuthNotice(null);
  };

  const signInWithGoogle = async () => {
    setAuthError(null);
    setAuthNotice(null);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const overrides = loadProfileOverrides(res.user.uid);
      setUser(res.user);
      setProfilePhoneNumber(
        overrides.phoneNumber !== undefined
          ? overrides.phoneNumber
          : res.user.phoneNumber || ''
      );
      setIsDemoUser(false);
      safeRemoveStorage(DEMO_STORAGE_KEY);
    } catch (error) {
      const code = (error as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }
      setAuthError('Connexion impossible. Veuillez réessayer ultérieurement.');
      console.warn("Erreur d'authentification Google:", code || error);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    setAuthNotice(null);
    const cleanEmail = email.trim();
    try {
      const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      await reload(credential.user);

      if (!credential.user.emailVerified) {
        try {
          await sendEmailVerification(credential.user, getVerificationActionSettings());
          setAuthNotice(
            `Un lien de confirmation vient d'être envoyé à ${credential.user.email || cleanEmail}. Cliquez sur ce lien dans votre boîte mail pour confirmer l'authentification.`
          );
        } catch (verifyError) {
          const code = (verifyError as { code?: string })?.code || '';
          if (code === 'auth/too-many-requests') {
            setAuthNotice(
              `Un lien de confirmation a déjà été envoyé à ${credential.user.email || cleanEmail}. Vérifiez votre boîte mail (et vos courriers indésirables).`
            );
          } else {
            setAuthError(mapFirebaseAuthError(verifyError));
          }
        }
        setUser(credential.user);
        setIsDemoUser(false);
        setProfileRevision((prev) => prev + 1);
        return;
      }

      await credential.user.getIdToken(true);
      const overrides = loadProfileOverrides(credential.user.uid);
      setUser(credential.user);
      setProfilePhoneNumber(
        overrides.phoneNumber !== undefined
          ? overrides.phoneNumber
          : credential.user.phoneNumber || ''
      );
      setIsDemoUser(false);
      safeRemoveStorage(DEMO_STORAGE_KEY);
      setProfileRevision((prev) => prev + 1);
    } catch (error) {
      setAuthError(mapFirebaseAuthError(error));
    }
  };

  const registerWithEmail = async (name: string, email: string, password: string) => {
    setAuthError(null);
    setAuthNotice(null);
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    try {
      const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      if (cleanName) {
        await updateProfile(credential.user, { displayName: cleanName });
      }
      await sendEmailVerification(credential.user, getVerificationActionSettings());
      setUser(credential.user);
      setIsDemoUser(false);
      safeRemoveStorage(DEMO_STORAGE_KEY);
      setAuthNotice(
        `Un lien de confirmation vient d'être envoyé à ${cleanEmail}. Cliquez sur le lien reçu dans votre boîte mail pour confirmer votre compte.`
      );
      setProfileRevision((prev) => prev + 1);
    } catch (error) {
      setAuthError(mapFirebaseAuthError(error));
    }
  };

  const resendVerificationEmail = async () => {
    setAuthError(null);
    setAuthNotice(null);
    if (!auth.currentUser) {
      setAuthError('Aucun compte en attente de confirmation.');
      return;
    }

    try {
      await reload(auth.currentUser);
      if (auth.currentUser.emailVerified) {
        await auth.currentUser.getIdToken(true);
        setUser(auth.currentUser);
        setProfileRevision((prev) => prev + 1);
        return;
      }
      await sendEmailVerification(auth.currentUser, getVerificationActionSettings());
      setAuthNotice(
        `Un nouveau lien de confirmation a été envoyé à ${auth.currentUser.email}.`
      );
    } catch (error) {
      setAuthError(mapFirebaseAuthError(error));
    }
  };

  const refreshVerificationStatus = async (): Promise<boolean> => {
    setAuthError(null);
    if (!auth.currentUser) {
      return false;
    }

    try {
      await reload(auth.currentUser);
      if (auth.currentUser.emailVerified) {
        await auth.currentUser.getIdToken(true);
        setUser(auth.currentUser);
        setAuthNotice(null);
        setProfileRevision((prev) => prev + 1);
        return true;
      }
      setAuthError(
        "Votre adresse e-mail n'est pas encore confirmée. Ouvrez votre boîte mail et cliquez sur le lien de confirmation."
      );
      return false;
    } catch (error) {
      setAuthError(mapFirebaseAuthError(error));
      return false;
    }
  };

  const sendPasswordReset = async (email: string) => {
    setAuthError(null);
    setAuthNotice(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAuthError('Saisissez votre adresse e-mail dans le champ ci-dessous pour recevoir le lien de réinitialisation.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, cleanEmail, getVerificationActionSettings());
      setAuthNotice(
        `Un lien de réinitialisation du mot de passe a été envoyé à ${cleanEmail}.`
      );
    } catch (error) {
      setAuthError(mapFirebaseAuthError(error));
    }
  };

  const updateUserProfile = async (updates: UserProfileOverrides) => {
    if (!user) return;
    const currentOverrides = loadProfileOverrides(user.uid);
    const nextOverrides: UserProfileOverrides = { ...currentOverrides };

    if (updates.displayName !== undefined) {
      const cleanName = updates.displayName.trim();
      if (cleanName) {
        nextOverrides.displayName = cleanName;
        if (!isDemoUser && auth.currentUser) {
          await updateProfile(auth.currentUser, { displayName: cleanName });
        } else {
          const updatedDemo = createMockUser(cleanName, user.email || 'mathieu.dr@smilo.mg');
          safeSetStorage(
            DEMO_STORAGE_KEY,
            JSON.stringify({ name: cleanName, email: updatedDemo.email })
          );
          setUser(updatedDemo);
        }
      }
    }

    if (updates.phoneNumber !== undefined) {
      const cleanPhone = updates.phoneNumber.trim();
      nextOverrides.phoneNumber = cleanPhone;
      setProfilePhoneNumber(cleanPhone);
    }

    saveProfileOverrides(user.uid, nextOverrides);
    setProfileRevision((prev) => prev + 1);
  };

  const signOutUser = async () => {
    setAuthError(null);
    setAuthNotice(null);
    safeRemoveStorage(DEMO_STORAGE_KEY);
    setIsDemoUser(false);
    setUser(null);
    setProfilePhoneNumber('');
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
    }
  };

  const clearAuthError = () => setAuthError(null);
  const clearAuthNotice = () => setAuthNotice(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isDemoUser,
        isAuthenticated,
        needsEmailVerification,
        authError,
        authNotice,
        profilePhoneNumber,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        resendVerificationEmail,
        refreshVerificationStatus,
        sendPasswordReset,
        signInAsDemo,
        signOutUser,
        updateUserProfile,
        clearAuthError,
        clearAuthNotice,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
