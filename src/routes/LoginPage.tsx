import { useState } from 'react';
import { supabase } from '../lib/supabase';
import './LoginPage.css';

const PROD_URL = 'https://geome-app.vercel.app';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError('');

    const redirectUrl = window.location.hostname === 'localhost'
      ? `${window.location.origin}/form`
      : `${PROD_URL}/form`;

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectUrl },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    sessionStorage.setItem('analysisEmail', email);
    setSent(true);
    setLoading(false);
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
      </div>
    </div>
  );
}
