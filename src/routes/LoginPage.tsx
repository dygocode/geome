import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { supabase } from '../lib/supabase';
import './LoginPage.css';

export function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Email invalido');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('api', {
        body: { route: 'login', email, check_only: true },
      });

      if (fnError) throw new Error(fnError.message);

      setIsNewUser(data.isNew);
      setStep('password');
    } catch (err: any) {
      setError(err.message || 'Erro ao verificar email');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (isNewUser && password !== confirmPassword) {
      setError('As senhas nao coincidem');
      return;
    }

    if (password.length < 4) {
      setError('A senha deve ter pelo menos 4 caracteres');
      return;
    }

    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('api', {
        body: { route: 'login', email, password },
      });

      if (fnError) throw new Error(fnError.message);
      if (data.error) throw new Error(data.error);

      sessionStorage.setItem('analysisEmail', email);
      navigate({ to: '/form', search: { email } });
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>Bem-vindo ao Geome</h2>
        <p className="login-subtitle">
          Analise sua presenca nas maiores LLMs e descubra seu ranking.
        </p>

        {step === 'email' ? (
          <form className="login-form" onSubmit={handleEmailSubmit}>
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
              {loading ? 'Verificando...' : 'Continuar'}
            </button>
            {error && <p className="error-text">{error}</p>}
          </form>
        ) : (
          <form className="login-form" onSubmit={handlePasswordSubmit}>
            {isNewUser && (
              <p className="login-new-user">Nova conta — crie sua senha</p>
            )}
            <div className="form-group">
              <label htmlFor="password">Senha</label>
              <input
                id="password"
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
            </div>
            {isNewUser && (
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirmar senha</label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Entrando...' : isNewUser ? 'Criar conta' : 'Entrar'}
            </button>
            {error && <p className="error-text">{error}</p>}
            <button
              type="button"
              className="btn-back"
              onClick={() => { setStep('email'); setPassword(''); setConfirmPassword(''); setError(''); }}
            >
              Voltar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
