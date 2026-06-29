import { useState, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { CompanyForm } from '../components/CompanyForm';
import { canUseAnalysis, incrementUsage } from '../api/subscription';
import { submitAnalysis } from '../api/client';
import type { CompanyFormData } from '../types';
import './HomePage.css';

export function HomePage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { email?: string };
  const [isLoading, setIsLoading] = useState(false);
  const [expired, setExpired] = useState(false);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const email = search.email || sessionStorage.getItem('analysisEmail');
    if (email) {
      canUseAnalysis(email).then(({ remaining: r, expired: exp }) => {
        setRemaining(r);
        setExpired(exp);
      });
    }
  }, [search.email]);

  async function handleSubmit(data: CompanyFormData) {
    const email = search.email || sessionStorage.getItem('analysisEmail') || data.email;

    try {
      const { allowed, subscription, expired: exp } = await canUseAnalysis(email);

      if (exp) {
        setExpired(true);
        sessionStorage.setItem('pendingAnalysisForm', JSON.stringify(data));
        sessionStorage.setItem('analysisEmail', email);
        navigate({ to: '/subscribe', search: { email } });
        return;
      }

      if (!allowed || !subscription) {
        sessionStorage.setItem('pendingAnalysisForm', JSON.stringify(data));
        sessionStorage.setItem('analysisEmail', email);
        navigate({ to: '/subscribe', search: { email } });
        return;
      }

      setIsLoading(true);
      setRemaining(remaining - 1);
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

  // Check for pending analysis after payment
  const pendingForm = sessionStorage.getItem('pendingAnalysisForm');
  if (pendingForm && search.email && !isLoading) {
    canUseAnalysis(search.email).then(({ allowed, subscription }) => {
      if (allowed && subscription) {
        setIsLoading(true);
        const data: CompanyFormData = JSON.parse(pendingForm);
        sessionStorage.removeItem('pendingAnalysisForm');
        incrementUsage(subscription.id).then(() =>
          submitAnalysis(data).then((result) => {
            sessionStorage.setItem('analysisResult', JSON.stringify(result));
            sessionStorage.setItem('analysisForm', JSON.stringify(data));
            navigate({ to: '/analysis', search: { email: search.email } });
          })
        );
      }
    });
    return (
      <div style={{ textAlign: 'center', padding: '4rem 0' }}>
        <p>Processando sua analise...</p>
      </div>
    );
  }

  return (
    <>
      {expired && (
        <div className="expired-bar">
          <span>Seu plano expirou. Renove para continuar analisando.</span>
          <button
            className="btn-renew"
            onClick={() => navigate({ to: '/subscribe', search: { email: search.email || '' } })}
          >
            Renovar
          </button>
        </div>
      )}
      {!expired && remaining > 0 && (
        <div className="subscription-bar">
          <span>
            <strong>{remaining}</strong> {remaining === 1 ? 'analise restante' : 'analises restantes'}
          </span>
        </div>
      )}
      <CompanyForm onSubmit={handleSubmit} isLoading={isLoading} />
    </>
  );
}
