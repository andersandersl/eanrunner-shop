import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { ApprovedAccount } from './types';
import { auth, db } from './firebase';

type AuthContextValue = {
  user: User | null;
  idToken: string | undefined;
  approvedAccount: ApprovedAccount | null;
  loading: boolean;
  authError: string;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | undefined>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeSupplierIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(['dcs', 'difox', 'dremote', 'cenor', 'egenta']);
  const normalized = value
    .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
    .filter((entry) => allowed.has(entry));
  return [...new Set(normalized)];
}

async function loadApprovedAccount(email: string): Promise<ApprovedAccount | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const snapshot = await getDocs(
    query(collection(db, 'approved_emails'), where('email', '==', normalizedEmail)),
  );

  if (snapshot.empty) {
    return null;
  }

  const raw = snapshot.docs[0].data();
  return {
    email: normalizedEmail,
    isAdmin: raw.isAdmin === true,
    isSuperAdmin: raw.isSuperAdmin === true,
    allowedSuppliers: normalizeSupplierIds(raw.allowedSuppliers),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | undefined>(undefined);
  const [approvedAccount, setApprovedAccount] = useState<ApprovedAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setLoading(true);
      setAuthError('');

      if (!nextUser?.email) {
        setUser(null);
        setIdToken(undefined);
        setApprovedAccount(null);
        setLoading(false);
        return;
      }

      try {
        const approved = await loadApprovedAccount(nextUser.email);
        if (!approved) {
          await signOut(auth);
          setUser(null);
          setApprovedAccount(null);
          setAuthError('This email is not approved for supplier access.');
          setLoading(false);
          return;
        }

        setUser(nextUser);
        setApprovedAccount(approved);
        // Fetch and cache the ID token immediately after login
        try {
          const token = await nextUser.getIdToken();
          setIdToken(token);
        } catch {
          setIdToken(undefined);
        }
      } catch {
        setUser(null);
        setApprovedAccount(null);
        setAuthError('Could not verify approval status. Please try again.');
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    idToken,
    approvedAccount,
    loading,
    authError,
    signInWithGoogle: async () => {
      setAuthError('');
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    signInWithEmail: async (email: string, password: string) => {
      setAuthError('');
      await signInWithEmailAndPassword(auth, email, password);
    },
    logout: async () => {
      setAuthError('');
      await signOut(auth);
    },
    getIdToken: async () => {
      if (!auth.currentUser) return undefined;
      return auth.currentUser.getIdToken();
    },
  }), [approvedAccount, authError, idToken, loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
