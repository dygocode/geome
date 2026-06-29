import { useState, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { CompanyForm } from '../components/CompanyForm';
import { canUseAnalysis, incrementUsage } from '../api/subscription';
import { submitAnalysis } from '../api/client';
import type { CompanyFormData } from '../types';

export function HomePage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { email?: string };
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    remaining: number;
    email: string;
  } | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    runPendingAnalysis();
  }, []);

  async function runPendingAnalysis() {
    const pendingForm = sessionStorage.getItem('pendingAnalysisForm');
    const email = search.email || sessionStorage.getItem('analysisEmail');

    if (pendingForm && email) {
      const { allowed, subscription } = await canUseAnalysis(email);
      if (allowed && subscription) {
        setIsLoading(true);
        try {
          const data: CompanyFormData = JSON.parse(pendingForm);
          await incrementUsage(subscription.id);
          const result = await submitAnalysis(data);
          sessionStorage.removeItem('pendingAnalysisForm');
          sessionStorage.setItem('analysisResult', JSON.stringify(result));
          sessionStorage.setItem('analysisForm', JSON.stringify(data));
          sessionStorage.setItem('analysisEmail', email);
          navigate({ to: '/analysis', search: { email } });
          return;
        } catch (err) {
          console.error('Analysis failed:', err);
        } finally {
          setIsLoading(false);
        }
      }
    }

    if (search.email) {
      try {
        const { allowed, remaining, subscription } = await canUseAnalysis(search.email);
        if (allowed && subscription) {
          setSubscriptionInfo({ remaining, email: search.email });
          sessionStorage.setItem('analysisEmail', search.email);
        }
      } catch {
        // No subscription
      }
    }
    setChecking(false);
  }

  async function handleSubmit(data: CompanyFormData) {
    const email = subscriptionInfo?.email || data.email;

    const { allowed, subscription } = await canUseAnalysis(email);
    if (!allowed || !subscription) {
      sessionStorage.setItem('pendingAnalysisForm', JSON.stringify(data));
      sessionStorage.setItem('analysisEmail', email);
      navigate({ to: '/subscribe', search: { email } });
      return;
    }

    setIsLoading(true);
    try {
      await incrementUsage(subscription.id);
      const result = await submitAnalysis(data);
      sessionStorage.setItem('analysisResult', JSON.stringify(result));
      sessionStorage.setItem('analysisForm', JSON.stringify(data));
      sessionStorage.setItem('analysisEmail', email);
      navigate({ to: '/analysis', search: { email } });
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setIsLoading(false);
    }
  }

  if (checking) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 0' }}>
        <p>Verificando assinatura...</p>
      </div>
    );
  }

  return (
    <>
      {subscriptionInfo && (
        <div className="subscription-bar">
          <span>
            Assinatura ativa |{' '}
            <strong>{subscriptionInfo.remaining} analises restantes</strong>
          </span>
        </div>
      )}
      {!subscriptionInfo && (
        <div className="subscription-bar subscription-bar--cta">
          <span>Plano: 5 analises por R$ 3,00</span>
          <button
            className="btn-subscribe"
            onClick={() => navigate({ to: '/subscribe' })}
          >
            Assinar
          </button>
        </div>
      )}
      <CompanyForm onSubmit={handleSubmit} isLoading={isLoading} />
    </>
  );
}
