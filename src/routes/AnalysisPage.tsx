import { useNavigate } from '@tanstack/react-router';
import { AnalysisResult } from '../components/AnalysisResult';
import type { BrandPresenceResult } from '../types';

export function AnalysisPage() {
  const navigate = useNavigate();
  const raw = sessionStorage.getItem('analysisResult');

  if (!raw) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 0' }}>
        <h2>Nenhuma analise encontrada</h2>
        <p style={{ margin: '1rem 0 1.5rem', color: 'var(--color-chumbo)' }}>
          Execute uma analise primeiro para ver os resultados.
        </p>
        <button
          onClick={() => navigate({ to: '/' })}
          style={{
            background: 'var(--color-ambar)',
            color: 'var(--color-grafite)',
            padding: '0.75rem 2rem',
            fontSize: '1rem',
          }}
        >
          Voltar
        </button>
      </div>
    );
  }

  const result: BrandPresenceResult = JSON.parse(raw);

  return (
    <AnalysisResult
      result={result}
      onReset={() => {
        sessionStorage.removeItem('analysisResult');
        sessionStorage.removeItem('analysisForm');
        navigate({ to: '/' });
      }}
    />
  );
}
