import { useState, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  getOrCreateSubscription,
  generatePayment,
  checkAndActivatePayment,
  canUseAnalysis,
  PLAN_CONFIG,
  type Subscription,
  type Payment,
} from '../api/subscription';
import './SubscribePage.css';

export function SubscribePage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { email?: string };

  const [email, setEmail] = useState(search.email || '');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const hasPendingForm = !!sessionStorage.getItem('pendingAnalysisForm');

  useEffect(() => {
    if (search.email) {
      checkExistingSubscription(search.email);
    }
  }, []);

  async function checkExistingSubscription(emailAddr: string) {
    setLoading(true);
    try {
      const { allowed, subscription: sub } = await canUseAnalysis(emailAddr);
      if (allowed && sub) {
        navigate({ to: '/', search: { email: emailAddr } });
        return;
      }
      await handleEmailSubmitWith(emailAddr);
    } catch {
      // No subscription, proceed to payment
      await handleEmailSubmitWith(emailAddr);
    } finally {
      setLoading(false);
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

      if (pay) {
        setPayment(pay);
      } else {
        try {
          const newPayment = await generatePayment(sub.id, emailAddr);
          setPayment(newPayment);
        } catch (pixErr: any) {
          setError(`Erro PIX: ${pixErr.message}`);
        }
      }
    } catch (err: any) {
      setError('Erro ao processar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit() {
    if (!email) return;
    sessionStorage.setItem('analysisEmail', email);
    await handleEmailSubmitWith(email);
  }

  async function handleCheckPayment() {
    if (!payment) return;
    setChecking(true);
    try {
      const { activated, subscription: sub } = await checkAndActivatePayment(payment.id);
      if (activated && sub) {
        setSubscription(sub);
        navigate({ to: '/', search: { email } });
      } else {
        setError('Pagamento ainda nao confirmado. Aguarde alguns instantes.');
      }
    } catch (err) {
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

  return (
    <div className="subscribe-page">
      <div className="subscribe-card">
        <h2>Plano Geome</h2>
        <div className="plan-badge">
          <span className="plan-limit">{PLAN_CONFIG.analysesLimit} analises</span>
          <span className="plan-price">R$ {(PLAN_CONFIG.priceCents / 100).toFixed(2).replace('.', ',')}</span>
        </div>

        {hasPendingForm && (
          <div className="pending-notice">
            Pague para desbloquear sua analise
          </div>
        )}

        {!subscription ? (
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
              {loading ? 'Processando...' : 'Gerar PIX'}
            </button>
            {error && <p className="error-text">{error}</p>}
          </form>
        ) : subscription.status === 'active' ? (
          <div className="active-state">
            <p>Assinatura ativa!</p>
            <p className="remaining">
              {subscription.analyses_limit - subscription.analyses_used} analises restantes
            </p>
            <button className="btn-primary" onClick={() => navigate({ to: '/', search: { email } })}>
              {hasPendingForm ? 'Ver Resultado' : 'Iniciar Analise'}
            </button>
          </div>
        ) : payment ? (
          <div className="payment-section">
            <h3>Pague via PIX</h3>
            <p className="bank-info">
              Banco Inter S.A. | Agencia {payment.agency}
            </p>

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
        ) : null}
      </div>
    </div>
  );
}
