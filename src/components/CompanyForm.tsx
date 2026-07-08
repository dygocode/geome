import { useState } from 'react';
import type { CompanyFormData, SegmentOption } from '../types';
import { t } from '../i18n';
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

function isValidDomain(value: string): boolean {
  const cleaned = value.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/.test(cleaned);
}

export function CompanyForm({ onSubmit, isLoading }: CompanyFormProps) {
  const [form, setForm] = useState<CompanyFormData>(INITIAL_STATE);
  const [websiteError, setWebsiteError] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'website') setWebsiteError('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidDomain(form.website)) {
      setWebsiteError('Invalid website format');
      return;
    }
    const data = { ...form, website: 'https://' + form.website.replace(/^https?:\/\//, '') };
    onSubmit(data);
  }

  return (
    <form className="company-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <h2>{t('formTitle')}</h2>
        <p>{t('formDescription')}</p>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label htmlFor="companyName">{t('companyName')}</label>
          <input
            id="companyName"
            name="companyName"
            type="text"
            placeholder={t('companyNamePlaceholder')}
            value={form.companyName}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="website">{t('website')}</label>
          <div className="input-prefix">
            <span className="input-prefix-label">https://</span>
            <input
              id="website"
              name="website"
              type="text"
              placeholder={t('websitePlaceholder')}
              value={form.website}
              onChange={handleChange}
              required
            />
          </div>
          {websiteError && <span className="field-error">{websiteError}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="segment">{t('segment')}</label>
          <select
            id="segment"
            name="segment"
            value={form.segment}
            onChange={handleChange}
            required
          >
            <option value="" disabled>
              {t('segmentPlaceholder')}
            </option>
            {SEGMENTS.map((seg) => (
              <option key={seg} value={seg}>
                {seg}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="location">{t('location')}</label>
          <input
            id="location"
            name="location"
            type="text"
            placeholder={t('locationPlaceholder')}
            value={form.location}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="contactName">{t('contactName')}</label>
          <input
            id="contactName"
            name="contactName"
            type="text"
            placeholder={t('contactNamePlaceholder')}
            value={form.contactName}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">{t('email')}</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder={t('emailPlaceholder')}
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
            {t('analyzing')}
          </span>
        ) : (
          t('startAnalysis')
        )}
      </button>
    </form>
  );
}
