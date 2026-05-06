import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth-context';

export default function LoginArea() {
  const { user, signInWithEmail, signInWithGoogle, logout, authError, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const disabled = submitting || loading;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (user) {
    return (
      <button
        type="button"
        onClick={() => void logout()}
        className="inline-flex items-center rounded-md border border-[hsl(220_14%_85%)] bg-white px-3 py-1.5 text-xs font-semibold text-[hsl(222_47%_12%)] hover:bg-[hsl(220_18%_97%)] transition-colors"
      >
        Logout
      </button>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center rounded-md border border-[hsl(220_14%_85%)] bg-white px-3 py-1.5 text-xs font-semibold text-[hsl(222_47%_12%)] hover:bg-[hsl(220_18%_97%)] transition-colors"
      >
        Login
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl border border-[hsl(220_14%_89%)] bg-white p-4 shadow-lg">
          <p className="text-sm font-semibold text-[hsl(222_47%_8%)]">Sign in to unlock supplier data</p>
          <p className="mt-1 text-xs text-[hsl(220_12%_45%)]">Only approved emails can access supplier prices and stock.</p>

          <div className="mt-3 space-y-2">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-[hsl(220_14%_89%)] bg-[hsl(220_18%_97%)] px-3 py-2 text-xs"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && email && password && !disabled) {
                  setSubmitting(true);
                  try { await signInWithEmail(email, password); setOpen(false); } finally { setSubmitting(false); }
                }
              }}
              className="w-full rounded-md border border-[hsl(220_14%_89%)] bg-[hsl(220_18%_97%)] px-3 py-2 text-xs"
            />
          </div>

          {authError && <p className="mt-2 text-xs text-red-600">{authError}</p>}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={disabled || !email || !password}
              onClick={async () => {
                setSubmitting(true);
                try { await signInWithEmail(email, password); setOpen(false); } finally { setSubmitting(false); }
              }}
              className="rounded-md bg-[hsl(221_92%_55%)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {submitting ? 'Signing in…' : 'Email sign in'}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={async () => {
                setSubmitting(true);
                try { await signInWithGoogle(); setOpen(false); } finally { setSubmitting(false); }
              }}
              className="rounded-md border border-[hsl(220_14%_89%)] bg-white px-3 py-2 text-xs font-semibold text-[hsl(222_47%_8%)] disabled:opacity-50"
            >
              Google sign in
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
