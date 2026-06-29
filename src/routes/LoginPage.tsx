import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { supabase } from '../lib/supabase';
import './LoginPage.css';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  async function handleSkip() {
    const fakeEmail = `guest-${Date.now()}@geome.app`;
    sessionStorage.setItem('analysisEmail', fakeEmail);
    navigate({ to: '/form', search: { email: fakeEmail } });
  }

  if (sent) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h2>Verifique seu email</h2>
          <p>Enviamos um link de acesso para <strong>{email}</strong></p>
          <p className="login-hint">Clique no link para acessar o Geome.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>Bem-vindo ao Geome</h2>
        <p className="login-subtitle">
          Analise sua presenca nas maiores LLMs e descubra seu ranking.
        </p>

        <form className="login-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email corporativo</label>
            <input
              id="email"
              type="email"
              placeholder="seu@email.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Enviando...' : 'Entrar com email'}
          </button>
          {error && <p className="error-text">{error}</p>}
        </form>

        <div className="login-divider">
          <span>ou</span>
        </div>

        <button className="btn-skip" onClick={handleSkip}>
          Continuar sem login
        </button>
      </div>
    </div>
  );
}
