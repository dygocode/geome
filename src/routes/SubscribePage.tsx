import { useState, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  getOrCreateSubscription,
  generatePayment,
  checkAndActivatePayment,
  PLAN_CONFIG,
  type Subscription,
  type Payment,
} from '../api/subscription';
import './SubscribePage.css';

export function SubscribePage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { email?: string };

  const email = search.email || sessionStorage.getItem('analysisEmail') || '';
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const limitReached = subscription?.status === 'active' &&
    subscription.analyses_used >= subscription.analyses_limit;

  useEffect(() => {
    if (email) {
      loadPayment(email);
    } else {
      setLoading(false);
    }
  }, []);

  async function loadPayment(emailAddr: string) {
    setLoading(true);
    setError('');
    try {
      const { subscription: sub, payment: pay } = await getOrCreateSubscription(emailAddr);
      setSubscription(sub);

      // If active and limit NOT reached, go to form
      if (sub.status === 'active' && sub.analyses_used < sub.analyses_limit) {
        navigate({ to: '/form', search: { email: emailAddr } });
        return;
      }

      // If pending, show payment flow
      if (sub.status === 'pending') {
        if (pay) {
          setPayment(pay);
        } else {
          const newPayment = await generatePayment(sub.id, emailAddr);
          setPayment(newPayment);
        }
      }
      // If active but limit reached, stay on this page to show renewal option
    } catch (err: any) {
      setError(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckPayment() {
    if (!payment) return;
    setChecking(true);
    try {
      const { activated, subscription: sub } = await checkAndActivatePayment(payment.id);
      if (activated && sub) {
        setSubscription(sub);
        navigate({ to: '/form', search: { email } });
      } else {
        setError('Pagamento ainda nao confirmado. Aguarde alguns instantes.');
      }
    } catch {
      setError('Erro ao verificar pagamento.');
    } finally {
      setChecking(false);
    }
  }

  async function handleRenew() {
    if (!subscription) return;
    setChecking(true);
    setError('');
    try {
      // Generate new payment for renewal
      const newPayment = await generatePayment(subscription.id, email);
      setPayment(newPayment);
    } catch (err: any) {
      setError(`Erro ao renovar: ${err.message}`);
    } finally {
      setChecking(false);
    }
  }

  function handleCopyPix() {
    if (!payment?.pix_copy_paste) return;
    navigator.clipboard.writeText(payment.pix_copy_paste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="subscribe-page">
        <div className="subscribe-card">
          <h2>Preparando pagamento...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="subscribe-page">
      <div className="subscribe-card">
        {limitReached && !payment ? (
          <>
            <h2>Limite Atingido</h2>
            <div className="plan-badge">
              <span className="plan-limit">{PLAN_CONFIG.analysesLimit} analises</span>
              <span className="plan-price">R$ {(PLAN_CONFIG.priceCents / 100).toFixed(2).replace('.', ',')}</span>
            </div>
            <p className="limit-message">
              Voce utilizou todas as {subscription?.analyses_limit} analises do seu plano.
            </p>
            <p className="limit-submessage">
              Renove para receber mais 5 analises e continuar analisando sua presenca nas IAs.
            </p>
            <button
              className="btn-primary"
              onClick={handleRenew}
              disabled={checking}
            >
              {checking ? 'Gerando pagamento...' : 'Renovar Plano'}
            </button>
            {error && <p className="error-text">{error}</p>}
          </>
        ) : payment ? (
          <>
            <h2>{limitReached ? 'Renovar Plano' : 'Desbloquear Analise'}</h2>
            <div className="plan-badge">
              <span className="plan-limit">{PLAN_CONFIG.analysesLimit} analises</span>
              <span className="plan-price">R$ {(PLAN_CONFIG.priceCents / 100).toFixed(2).replace('.', ',')}</span>
            </div>

            <div className="payment-section">
              <h3>Pague via PIX</h3>
              <p className="bank-info">Mercado Pago</p>

              {payment.pix_qr_code && (
                <img
                  src={`data:image/png;base64,${payment.pix_qr_code}`}
                  alt="QR Code PIX"
                  className="pix-qrcode"
                />
              )}

              <button className="btn-copy" onClick={handleCopyPix}>
                {copied ? 'Copiado!' : 'Copiar codigo PIX'}
              </button>

              <button
                className="btn-check"
                onClick={handleCheckPayment}
                disabled={checking}
              >
                {checking ? 'Verificando...' : 'Ja paguei'}
              </button>

              {error && <p className="error-text">{error}</p>}

              <p className="hint">
                O pagamento e confirmado automaticamente em segundos.
              </p>
            </div>
          </>
        ) : (
          <p className="error-text">Nenhum pagamento encontrado.</p>
        )}
      </div>
    </div>
  );
}
