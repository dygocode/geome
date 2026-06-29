import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import './LoginPage.css';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Email invalido');
      return;
    }

    sessionStorage.setItem('analysisEmail', email);
    navigate({ to: '/form', search: { email } });
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
          <button type="submit" className="btn-primary">
            Comecar
          </button>
          {error && <p className="error-text">{error}</p>}
        </form>
      </div>
    </div>
  );
}
