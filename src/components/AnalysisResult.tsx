import type { BrandPresenceResult } from '../types';
import './AnalysisResult.css';

interface AnalysisResultProps {
  result: BrandPresenceResult;
  onReset: () => void;
}

function ScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;

  let color = 'var(--color-ambar)';
  if (score >= 80) color = '#4CAF50';
  else if (score >= 50) color = 'var(--color-mel)';
  else color = '#E57373';

  return (
    <div className="score-ring">
      <svg viewBox="0 0 100 100">
        <circle className="score-ring-bg" cx="50" cy="50" r="45" />
        <circle
          className="score-ring-fill"
          cx="50"
          cy="50"
          r="45"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="score-ring-value">
        <span className="score-number">{score}</span>
        <span className="score-label">/ 100</span>
      </div>
    </div>
  );
}

export function AnalysisResult({ result, onReset }: AnalysisResultProps) {
  return (
    <div className="analysis-result">
      <button className="back-button" onClick={onReset}>
        &larr; Nova Analise
      </button>

      <div className="result-overview">
        <div className="result-overview-left">
          <ScoreRing score={result.overallScore} />
          <div>
            <h2>Brand Presence Score</h2>
            <p className="result-summary">{result.summary}</p>
          </div>
        </div>
      </div>

      <h3>Presenca por Plataforma</h3>
      <div className="platform-grid">
        {result.brandMentions.map((mention) => (
          <div key={mention.platform} className="platform-card">
            <div className="platform-card-header">
              <span className="platform-name">{mention.platform}</span>
              <span className="platform-score">{mention.score}/100</span>
            </div>
            <div className="platform-bar">
              <div
                className="platform-bar-fill"
                style={{ width: `${mention.score}%` }}
              />
            </div>
            <p className="platform-context">{mention.context}</p>
            <ul className="platform-examples">
              {mention.examples.map((ex, i) => (
                <li key={i}>{ex}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="recommendations-section">
        <h3>Recomendacoes</h3>
        <ol className="recommendations-list">
          {result.recommendations.map((rec, i) => (
            <li key={i}>{rec}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
