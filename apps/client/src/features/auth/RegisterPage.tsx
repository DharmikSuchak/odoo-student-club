import { Mail, Lock, Eye, EyeOff, User, UserPlus } from 'lucide-react';
import { useState, useId } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiRequestError } from '../../lib/api-client';

import { useAuth } from './AuthContext';
import './auth.css';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();

  const [displayName, setDisplayName] = useState('');
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
      await register(email, password, displayName);
      // Redirect to login page with a success message (state can be read by LoginPage if desired)
      void navigate('/login');
    } catch (err) {
      if (err instanceof ApiRequestError && err.fields) {
        setFieldErrors(err.fields);
      }
      setErrorMessage(err instanceof Error ? err.message : 'Unable to connect. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <main className="auth-container">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="auth-logo" aria-hidden="true">
              <span>SC</span>
            </div>
            <h1 className="auth-title">Create account</h1>
            <p className="auth-subtitle">Join your student club platform</p>
          </div>

          {errorMessage !== null && (
            <div className="auth-error-banner" role="alert" aria-live="assertive">
              {errorMessage}
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} noValidate aria-busy={isSubmitting}>
            <div className="form-field">
              <label htmlFor={nameId} className="form-label">
                Full name
              </label>
              <div className="input-wrapper">
                <User className="input-icon" size={16} aria-hidden="true" />
                <input
                  id={nameId}
                  type="text"
                  className={`form-input ${(fieldErrors['displayName'] ?? []).length > 0 ? 'form-input--error' : ''}`}
                  placeholder="Jane Smith"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                  required
                  aria-required="true"
                  aria-describedby={
                    (fieldErrors['displayName'] ?? []).length > 0 ? `${nameId}-error` : undefined
                  }
                  aria-invalid={(fieldErrors['displayName'] ?? []).length > 0}
                />
              </div>
              {(fieldErrors['displayName'] ?? []).length > 0 && (
                <p id={`${nameId}-error`} className="form-field-error" role="alert">
                  {(fieldErrors['displayName'] ?? [])[0]}
                </p>
              )}
            </div>

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
                  placeholder="Uppercase, lowercase, number, symbol"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
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

            <button
              type="submit"
              className="btn-primary btn-full"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <span className="btn-spinner" aria-hidden="true" />
              ) : (
                <UserPlus size={16} aria-hidden="true" />
              )}
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="auth-footer-text">
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
