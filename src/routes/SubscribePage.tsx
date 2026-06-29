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

      if (sub.status === 'active') {
        navigate({ to: '/form', search: { email: emailAddr } });
        return;
      }

      if (pay) {
        setPayment(pay);
      } else {
        const newPayment = await generatePayment(sub.id, emailAddr);
        setPayment(newPayment);
      }
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
        // Re-run pending analysis
        const pendingForm = sessionStorage.getItem('pendingAnalysisForm');
        if (pendingForm) {
          navigate({ to: '/form', search: { email } });
        } else {
          navigate({ to: '/form', search: { email } });
        }
      } else {
        setError('Pagamento ainda nao confirmado. Aguarde alguns instantes.');
      }
    } catch {
      setError('Erro ao verificar pagamento.');
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
        <h2>Desbloquear Analise</h2>
        <div className="plan-badge">
          <span className="plan-limit">{PLAN_CONFIG.analysesLimit} analises</span>
          <span className="plan-price">R$ {(PLAN_CONFIG.priceCents / 100).toFixed(2).replace('.', ',')}</span>
        </div>

        {subscription?.status === 'active' ? (
          <div className="active-state">
            <p>Assinatura ativa!</p>
            <p className="remaining">
              {subscription.analyses_limit - subscription.analyses_used} analises restantes
            </p>
            <button className="btn-primary" onClick={() => navigate({ to: '/form', search: { email } })}>
              Iniciar Analise
            </button>
          </div>
        ) : payment ? (
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
        ) : (
          <p className="error-text">Nenhum pagamento encontrado.</p>
        )}
      </div>
    </div>
  );
}
