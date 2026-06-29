import { useState, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  getOrCreateSubscription,
  generatePayment,
  checkAndActivatePayment,
  PLAN_CONFIG,
  type Subscription,
} from '../api/subscription';
import './SubscribePage.css';

export function SubscribePage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { email?: string; paid?: string };

  const [email, setEmail] = useState(search.email || '');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (search.paid === 'true' && search.email) {
      handlePaymentReturn(search.email);
    } else if (search.email) {
      handleEmailSubmitWith(search.email);
    }
  }, []);

  async function handlePaymentReturn(emailAddr: string) {
    setChecking(true);
    try {
      const { subscription: sub } = await getOrCreateSubscription(emailAddr);
      if (sub) {
        const { data: payment } = await import('../lib/supabase').then(m =>
          m.supabase.from('payments').select('*').eq('subscription_id', sub.id).order('created_at', { ascending: false }).limit(1).single()
        );
        if (payment) {
          const { activated, subscription: activeSub } = await checkAndActivatePayment(payment.id);
          if (activated && activeSub) {
            setSubscription(activeSub);
            navigate({ to: '/', search: { email: emailAddr } });
            return;
          }
        }
      }
      setError('Pagamento ainda nao confirmado. Aguarde alguns instantes.');
    } catch {
      setError('Erro ao verificar pagamento.');
    } finally {
      setChecking(false);
    }
  }

  async function handleEmailSubmitWith(emailAddr: string) {
    setLoading(true);
    setError('');
    try {
      const { subscription: sub, payment: pay } = await getOrCreateSubscription(emailAddr);
      setSubscription(sub);

      if (sub.status === 'active') {
        navigate({ to: '/', search: { email: emailAddr } });
        return;
      }

      if (!pay) {
        setRedirecting(true);
        await generatePayment(sub.id, emailAddr);
      }
    } catch (err: any) {
      setError(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit() {
    if (!email) return;
    sessionStorage.setItem('analysisEmail', email);
    await handleEmailSubmitWith(email);
  }

  if (checking) {
    return (
      <div className="subscribe-page">
        <div className="subscribe-card">
          <h2>Verificando pagamento...</h2>
        </div>
      </div>
    );
  }

  if (redirecting) {
    return (
      <div className="subscribe-page">
        <div className="subscribe-card">
          <h2>Redirecionando para pagamento...</h2>
          <p>Aguarde, voce sera redirecionado para a pagina de pagamento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="subscribe-page">
      <div className="subscribe-card">
        <h2>Plano Geome</h2>
        <div className="plan-badge">
          <span className="plan-limit">{PLAN_CONFIG.analysesLimit} analises</span>
          <span className="plan-price">R$ {(PLAN_CONFIG.priceCents / 100).toFixed(2).replace('.', ',')}</span>
        </div>

        {!subscription || subscription.status !== 'active' ? (
          <form
            className="subscribe-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleEmailSubmit();
            }}
          >
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
              {loading ? 'Processando...' : 'Pagar com PIX'}
            </button>
            {error && <p className="error-text">{error}</p>}
          </form>
        ) : (
          <div className="active-state">
            <p>Assinatura ativa!</p>
            <p className="remaining">
              {subscription.analyses_limit - subscription.analyses_used} analises restantes
            </p>
            <button className="btn-primary" onClick={() => navigate({ to: '/', search: { email } })}>
              Iniciar Analise
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
