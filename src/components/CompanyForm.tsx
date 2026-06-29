import { useState } from 'react';
import type { CompanyFormData, SegmentOption } from '../types';
import './CompanyForm.css';

interface CompanyFormProps {
  onSubmit: (data: CompanyFormData) => void;
  isLoading: boolean;
}

const SEGMENTS: SegmentOption[] = [
  'Tecnologia',
  'Saude',
  'Financeiro',
  'Educacao',
  'Varejo',
  'Industria',
  'Servicos',
  'Outro',
];

const INITIAL_STATE: CompanyFormData = {
  companyName: '',
  website: '',
  segment: '',
  location: '',
  contactName: '',
  email: '',
};

export function CompanyForm({ onSubmit, isLoading }: CompanyFormProps) {
  const [form, setForm] = useState<CompanyFormData>(INITIAL_STATE);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <form className="company-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <h2>Analise sua presenca nas IAs</h2>
        <p>Preencha os dados da sua empresa para descobrir como sua marca aparece nas plataformas de inteligencia artificial.</p>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label htmlFor="companyName">Nome da empresa</label>
          <input
            id="companyName"
            name="companyName"
            type="text"
            placeholder="Qual o nome da sua empresa?"
            value={form.companyName}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="website">Site</label>
          <input
            id="website"
            name="website"
            type="url"
            placeholder="www.exemplo.com"
            value={form.website}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="segment">Segmento</label>
          <select
            id="segment"
            name="segment"
            value={form.segment}
            onChange={handleChange}
            required
          >
            <option value="" disabled>
              Selecione um segmento
            </option>
            {SEGMENTS.map((seg) => (
              <option key={seg} value={seg}>
                {seg}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="location">Localizacao da empresa</label>
          <input
            id="location"
            name="location"
            type="text"
            placeholder="Estado, cidade ou pais"
            value={form.location}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="contactName">Seu Nome</label>
          <input
            id="contactName"
            name="contactName"
            type="text"
            placeholder="Qual o seu nome?"
            value={form.contactName}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="Qual seu e-mail corporativo?"
            value={form.email}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <button type="submit" className="form-submit" disabled={isLoading}>
        {isLoading ? (
          <span className="loading-text">
            <span className="spinner" />
            Analisando...
          </span>
        ) : (
          'Iniciar Analise'
        )}
      </button>
    </form>
  );
}
