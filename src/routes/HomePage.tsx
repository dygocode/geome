import { useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { CompanyForm } from '../components/CompanyForm';
import { canUseAnalysis, incrementUsage } from '../api/subscription';
import { submitAnalysis } from '../api/client';
import type { CompanyFormData } from '../types';

export function HomePage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { email?: string };
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(data: CompanyFormData) {
    const email = search.email || sessionStorage.getItem('analysisEmail') || data.email;

    try {
      const { allowed, subscription } = await canUseAnalysis(email);
      if (!allowed || !subscription) {
        sessionStorage.setItem('pendingAnalysisForm', JSON.stringify(data));
        sessionStorage.setItem('analysisEmail', email);
        navigate({ to: '/subscribe', search: { email } });
        return;
      }

      setIsLoading(true);
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
    sessionStorage.removeItem('pendingAnalysisForm');
    canUseAnalysis(search.email).then(({ allowed, subscription }) => {
      if (allowed && subscription) {
        setIsLoading(true);
        const data: CompanyFormData = JSON.parse(pendingForm);
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

  return <CompanyForm onSubmit={handleSubmit} isLoading={isLoading} />;
}
