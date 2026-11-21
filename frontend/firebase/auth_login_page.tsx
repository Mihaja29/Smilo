import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GoogleIcon,
  AlertCircleIcon,
} from '../navigation/navigation_icons';
import { GmailInputField } from './gmail_input_field';
import { useAuth } from './auth_context';

// Boîte d'authentification et confirmation par lien e-mail
export const AuthLoginPage: React.FC = () => {
  const {
    user,
    needsEmailVerification,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    resendVerificationEmail,
    refreshVerificationStatus,
    sendPasswordReset,
    signOutUser,
    authError,
    authNotice,
    clearAuthError,
    clearAuthNotice,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');

  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayedError = localError || authError;

  const switchMode = (nextMode: 'login' | 'register') => {
    setLocalError(null);
    clearAuthError();
    clearAuthNotice();
    setMode(nextMode);
  };

  const handleGoogleLogin = async () => {
    setLocalError(null);
    clearAuthError();
    clearAuthNotice();
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setLocalError(null);
    clearAuthError();
    clearAuthNotice();
    setIsSubmitting(true);
    try {
      await sendPasswordReset(email);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();
    clearAuthNotice();

    if (mode === 'login') {
      const cleanEmail = email.trim();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        setLocalError('Veuillez saisir une adresse e-mail valide.');
        return;
      }
      if (!password) {
        setLocalError('Veuillez saisir votre mot de passe.');
        return;
      }

      setIsSubmitting(true);
      try {
        await signInWithEmail(cleanEmail, password);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const cleanName = registerName.trim();
    const cleanRegEmail = registerEmail.trim();
    if (!cleanName) {
      setLocalError('Veuillez saisir votre nom complet.');
      return;
    }
    if (!cleanRegEmail || !cleanRegEmail.includes('@')) {
      setLocalError('Veuillez saisir une adresse e-mail valide.');
      return;
    }
    if (registerPassword.length < 6) {
      setLocalError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      setLocalError('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);
    try {
      await registerWithEmail(cleanName, cleanRegEmail, registerPassword);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckVerification = async () => {
    setLocalError(null);
    setIsSubmitting(true);
    try {
      await refreshVerificationStatus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendLink = async () => {
    setLocalError(null);
    setIsSubmitting(true);
    try {
      await resendVerificationEmail();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      key="auth-container"
      id="auth-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[60] bg-[#111827]/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 font-poppins overflow-hidden sm:overflow-y-auto"
    >
      <motion.div
        key="auth-card"
        id="auth-card"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-h-[90dvh] sm:max-h-none overflow-y-auto sm:overflow-visible sm:max-w-xl md:max-w-3xl lg:max-w-4xl bg-[#FFFFFF] rounded-t-3xl sm:rounded-3xl shadow-2xl px-5 pt-3 pb-7 sm:p-8 md:p-10 mb-0 sm:my-auto"
      >
        <div
          className="w-12 h-1 bg-[#D1D5DB] rounded-full mx-auto mb-3 sm:hidden flex-shrink-0"
          aria-hidden="true"
        />

        {displayedError && (
          <div
            role="alert"
            className="w-full p-3 mb-4 sm:mb-6 bg-[#FEF2F2] border border-[#FECACA] rounded-xl flex items-start gap-2.5 text-xs text-[#DC2626] leading-relaxed"
          >
            <AlertCircleIcon className="w-4 h-4 text-[#DC2626] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{displayedError}</p>
            </div>
          </div>
        )}

        <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 md:gap-12 items-stretch">
          <div className="hidden sm:block absolute left-1/2 top-2 bottom-2 -translate-x-1/2 w-[1px] bg-[#E5E7EB]" />

          {/* SECTION GAUCHE */}
          <div className="hidden sm:flex flex-col justify-between space-y-6 h-full">
            <div className="space-y-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#111827] tracking-tight">
                {needsEmailVerification
                  ? 'Vérification requise'
                  : mode === 'login'
                    ? 'Bienvenue !'
                    : 'Créer un compte'}
              </h1>
              <p className="text-xs sm:text-sm text-[#374151] leading-relaxed">
                {needsEmailVerification
                  ? 'Pour sécuriser l’accès aux dossiers médicaux Smilo, confirmez votre adresse e-mail en cliquant sur le lien envoyé dans votre messagerie.'
                  : mode === 'login'
                    ? "Bienvenue sur votre espace Smilo. Connectez-vous pour gérer vos dossiers patients, suivre les soins et coordonner l'activité de vos cabinets (Anjanahary, Ambohitrimanjaka, Antanimena)."
                    : 'Rejoignez Smilo pour moderniser la gestion de votre cabinet et centraliser vos dossiers patients en toute sécurité.'}
              </p>
            </div>

            <div className="pt-3 border-t border-[#E5E7EB]">
              {needsEmailVerification ? (
                <p className="text-xs text-[#374151]">
                  Mauvaise adresse ?{' '}
                  <button
                    type="button"
                    onClick={() => void signOutUser()}
                    className="text-[#7C3AED] hover:text-[#6D28D9] font-medium transition-colors cursor-pointer"
                  >
                    Changer de compte
                  </button>
                </p>
              ) : mode === 'login' ? (
                <p className="text-xs text-[#374151]">
                  Pas encore de compte ?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className="text-[#7C3AED] hover:text-[#6D28D9] font-medium transition-colors cursor-pointer"
                  >
                    S'inscrire
                  </button>
                </p>
              ) : (
                <p className="text-xs text-[#374151]">
                  Vous avez déjà un compte ?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="text-[#7C3AED] hover:text-[#6D28D9] font-medium transition-colors cursor-pointer"
                  >
                    Se connecter
                  </button>
                </p>
              )}
            </div>
          </div>

          {/* SECTION DROITE */}
          {needsEmailVerification ? (
            <div className="flex flex-col justify-between space-y-5 h-full">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h2 className="text-lg sm:text-xl font-bold text-[#111827]">
                    Confirmez votre adresse e-mail
                  </h2>
                  <p className="text-xs sm:text-sm text-[#374151] leading-relaxed">
                    Un lien de confirmation a été envoyé à{' '}
                    <span className="font-semibold text-[#111827]">
                      {user?.email || 'votre adresse e-mail'}
                    </span>
                    . Ouvrez votre boîte mail (pensez à vérifier les courriers indésirables) et cliquez sur le lien pour activer votre session.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleCheckVerification()}
                  className="w-full h-11 px-6 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] rounded-md text-xs sm:text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>J'ai confirmé mon adresse e-mail</span>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleResendLink()}
                  className="w-full h-11 px-5 bg-[#FFFFFF] hover:bg-[#F3F4F6] text-[#374151] border border-[#D1D5DB] rounded-md text-xs sm:text-sm font-medium flex items-center justify-center transition-colors disabled:opacity-60 cursor-pointer"
                >
                  Renvoyer le lien de confirmation
                </button>

                <div className="sm:hidden pt-2 text-center border-t border-[#E5E7EB]">
                  <button
                    type="button"
                    onClick={() => void signOutUser()}
                    className="text-xs text-[#7C3AED] hover:text-[#6D28D9] font-medium transition-colors cursor-pointer"
                  >
                    Utiliser un autre compte
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-between space-y-4 overflow-hidden h-full">
              <div className="h-10 flex items-center pb-1">
                <h2 className="text-lg sm:text-xl font-bold text-[#111827]">
                  {mode === 'login' ? 'Connexion' : 'Inscription'}
                </h2>
              </div>

              <AnimatePresence mode="wait">
                {mode === 'login' ? (
                  <motion.form
                    key="form-login"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    onSubmit={handleFormSubmit}
                    className="space-y-3.5 pt-0.5"
                  >
                    <GmailInputField
                      id="login-email"
                      label="Adresse e-mail"
                      type="email"
                      value={email}
                      onChange={setEmail}
                      autoComplete="email"
                      required
                    />

                    <GmailInputField
                      id="login-password"
                      label="Saisissez votre mot de passe"
                      type="password"
                      value={password}
                      onChange={setPassword}
                      autoComplete="current-password"
                      required
                    />

                    <div className="flex justify-end pr-1">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => void handleForgotPassword()}
                        className="text-xs text-[#374151] hover:text-[#111827] transition-colors cursor-pointer font-medium disabled:opacity-60"
                      >
                        Mot de passe oublié ?
                      </button>
                    </div>

                    {authNotice && (
                      <p role="status" className="text-xs text-[#2563EB] leading-relaxed">
                        {authNotice}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-11 px-6 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] rounded-md text-xs sm:text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      {isSubmitting ? (
                        <div className="w-4 h-4 border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span>Se connecter</span>
                      )}
                    </button>
                  </motion.form>
                ) : (
                  <motion.form
                    key="form-register"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    onSubmit={handleFormSubmit}
                    className="space-y-3.5 pt-0.5"
                  >
                    <GmailInputField
                      id="reg-name"
                      label="Nom complet"
                      type="text"
                      value={registerName}
                      onChange={setRegisterName}
                      autoComplete="name"
                      required
                    />

                    <GmailInputField
                      id="reg-email"
                      label="Adresse e-mail"
                      type="email"
                      value={registerEmail}
                      onChange={setRegisterEmail}
                      autoComplete="email"
                      required
                    />

                    <GmailInputField
                      id="reg-password"
                      label="Mot de passe"
                      type="password"
                      value={registerPassword}
                      onChange={setRegisterPassword}
                      autoComplete="new-password"
                      required
                    />

                    <GmailInputField
                      id="reg-confirm-password"
                      label="Confirmer le mot de passe"
                      type="password"
                      value={registerConfirmPassword}
                      onChange={setRegisterConfirmPassword}
                      autoComplete="new-password"
                      required
                    />

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-11 px-6 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] rounded-md text-xs sm:text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer mt-1 shadow-xs"
                    >
                      {isSubmitting ? (
                        <div className="w-4 h-4 border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span>Créer mon compte</span>
                      )}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>

              <div className="relative flex items-center justify-center my-2.5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#E5E7EB]" />
                </div>
                <span className="relative px-3 bg-[#FFFFFF] text-xs font-medium text-[#6B7280]">
                  ou
                </span>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  id="login-google-wide-button"
                  disabled={isSubmitting}
                  onClick={handleGoogleLogin}
                  className="w-full h-11 px-5 bg-[#FFFFFF] hover:bg-[#F3F4F6] text-[#111827] border border-[#D1D5DB] rounded-md text-xs sm:text-sm font-medium flex items-center justify-center gap-3 transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <GoogleIcon className="w-5 h-5 flex-shrink-0" />
                  )}
                  <span>Continuer avec Google</span>
                </button>
              </div>

              <div className="sm:hidden pt-2 text-center border-t border-[#E5E7EB]">
                {mode === 'login' ? (
                  <p className="text-xs text-[#374151]">
                    Pas encore de compte ?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="text-[#7C3AED] hover:text-[#6D28D9] font-medium transition-colors cursor-pointer"
                    >
                      S'inscrire
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-[#374151]">
                    Vous avez déjà un compte ?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-[#7C3AED] hover:text-[#6D28D9] font-medium transition-colors cursor-pointer"
                    >
                      Se connecter
                    </button>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
