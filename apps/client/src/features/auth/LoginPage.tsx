/**
 * Login page — /login
 *
 * Visual language: design-system.md §11 (Auth Screen).
 * - Outfit 36px extrabold title (text-auth-title)
 * - White card with 24px border radius (radius-auth)
 * - Subtle purple gradient background accent
 * - Brand Sky inputs with focus ring
 * - Accessible focus states on all interactive elements
 */
import { useState, useId } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';

import { useAuth } from './AuthContext';
import type { ApiError } from '../../lib/api-client';
import './auth.css';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const emailId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await login(email, password);
      void navigate('/dashboard');
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.fields) {
        try {
          const parsedFields = JSON.parse(apiError.message) as { fields: Record<string, string[]> };
          setFieldErrors(parsedFields.fields);
        } catch {
          setErrorMessage(apiError.message);
        }
      } else {
        setErrorMessage(apiError.message ?? 'An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg-gradient" aria-hidden="true" />

      <main className="auth-container">
        <div className="auth-card" role="main">
          {/* Branding */}
          <div className="auth-brand">
            <div className="auth-logo" aria-hidden="true">
              <span>SC</span>
            </div>
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-subtitle">Sign in to your student club account</p>
          </div>

          {/* Error banner */}
          {errorMessage !== null && (
            <div className="auth-error-banner" role="alert" aria-live="assertive">
              {errorMessage}
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} noValidate>
            {/* Email */}
            <div className="form-field">
              <label htmlFor={emailId} className="form-label">
                Email address
              </label>
              <div className="input-wrapper">
                <Mail className="input-icon" size={16} aria-hidden="true" />
                <input
                  id={emailId}
                  type="email"
                  className={`form-input ${(fieldErrors['email'] ?? []).length > 0 ? 'form-input--error' : ''}`}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  aria-required="true"
                  aria-describedby={
                    (fieldErrors['email'] ?? []).length > 0 ? `${emailId}-error` : undefined
                  }
                  aria-invalid={(fieldErrors['email'] ?? []).length > 0}
                />
              </div>
              {(fieldErrors['email'] ?? []).length > 0 && (
                <p id={`${emailId}-error`} className="form-field-error" role="alert">
                  {(fieldErrors['email'] ?? [])[0]}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="form-field">
              <label htmlFor={passwordId} className="form-label">
                Password
              </label>
              <div className="input-wrapper">
                <Lock className="input-icon" size={16} aria-hidden="true" />
                <input
                  id={passwordId}
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input form-input--password ${(fieldErrors['password'] ?? []).length > 0 ? 'form-input--error' : ''}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  aria-required="true"
                  aria-describedby={
                    (fieldErrors['password'] ?? []).length > 0 ? `${passwordId}-error` : undefined
                  }
                  aria-invalid={(fieldErrors['password'] ?? []).length > 0}
                />
                <button
                  type="button"
                  className="input-toggle-visibility"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {(fieldErrors['password'] ?? []).length > 0 && (
                <p id={`${passwordId}-error`} className="form-field-error" role="alert">
                  {(fieldErrors['password'] ?? [])[0]}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn-primary btn-full"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <span className="btn-spinner" aria-hidden="true" />
              ) : (
                <LogIn size={16} aria-hidden="true" />
              )}
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Footer link */}
          <p className="auth-footer-text">
            Don't have an account?{' '}
            <Link to="/register" className="auth-link">
              Create one
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
