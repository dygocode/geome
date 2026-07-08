import { useState } from 'react';
import { Outlet } from '@tanstack/react-router';
import { getLocale, setLocale, type Locale } from '../i18n';
import './Layout.css';

export function Layout() {
  const [locale, setLocaleState] = useState<Locale>(getLocale());

  function toggleLocale() {
    const next = locale === 'pt-BR' ? 'en' : 'pt-BR';
    setLocaleState(next);
    setLocale(next);
    window.location.reload();
  }

  return (
    <div className="layout">
      <header className="layout-header">
        <div className="layout-header-inner">
          <h1 className="layout-logo">Geome</h1>
          <span className="layout-tagline">Analise sua marca nas maiores LLMs e descubra seu Ranking</span>
          <button className="locale-toggle" onClick={toggleLocale}>
            {locale === 'pt-BR' ? 'EN' : 'PT'}
          </button>
        </div>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
      <footer className="layout-footer">
        <p>Geome &mdash; Analise de presenca da sua marca em plataformas de IA</p>
        <p className="layout-footer-brand">by DYGO SISTEMAS DIGITAIS</p>
      </footer>
    </div>
  );
}
