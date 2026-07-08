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
import { t } from '../i18n';
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
      setError(`Error: ${err.message}`);
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
        setError(t('paymentNotConfirmed'));
      }
    } catch {
      setError(t('paymentError'));
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
      setError(`Error: ${err.message}`);
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
          <h2>{t('loading')}</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="subscribe-page">
      <div className="subscribe-card">
        {limitReached && !payment ? (
          <>
            <h2>{t('limitReached')}</h2>
            <div className="plan-badge">
              <span className="plan-limit">{PLAN_CONFIG.analysesLimit} {t('analyses')}</span>
              <span className="plan-price">R$ {(PLAN_CONFIG.priceCents / 100).toFixed(2).replace('.', ',')}</span>
            </div>
            <p className="limit-message">
              {t('limitMessage', { limit: subscription?.analyses_limit || 5 })}
            </p>
            <p className="limit-submessage">
              {t('limitSubmessage')}
            </p>
            <button
              className="btn-primary"
              onClick={handleRenew}
              disabled={checking}
            >
              {checking ? t('generatePayment') : t('renewPlan')}
            </button>
            {error && <p className="error-text">{error}</p>}
          </>
        ) : payment ? (
          <>
            <h2>{limitReached ? t('renewPlan') : t('unlockAnalysis')}</h2>
            <div className="plan-badge">
              <span className="plan-limit">{PLAN_CONFIG.analysesLimit} {t('analyses')}</span>
              <span className="plan-price">R$ {(PLAN_CONFIG.priceCents / 100).toFixed(2).replace('.', ',')}</span>
            </div>

            <div className="payment-section">
              <h3>{t('payViaPix')}</h3>
              <p className="bank-info">{t('mercadoPago')}</p>

              {payment.pix_qr_code && (
                <img
                  src={`data:image/png;base64,${payment.pix_qr_code}`}
                  alt="QR Code PIX"
                  className="pix-qrcode"
                />
              )}

              <button className="btn-copy" onClick={handleCopyPix}>
                {copied ? t('copied') : t('copyPixCode')}
              </button>

              <button
                className="btn-check"
                onClick={handleCheckPayment}
                disabled={checking}
              >
                {checking ? t('verifying') : t('alreadyPaid')}
              </button>

              {error && <p className="error-text">{error}</p>}

              <p className="hint">
                {t('paymentConfirmed')}
              </p>
            </div>
          </>
        ) : (
          <p className="error-text">{t('noPayment')}</p>
        )}
      </div>
    </div>
  );
}
