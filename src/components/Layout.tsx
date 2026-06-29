import { Outlet } from '@tanstack/react-router';
import './Layout.css';

export function Layout() {
  return (
    <div className="layout">
      <header className="layout-header">
        <div className="layout-header-inner">
          <h1 className="layout-logo">Geome</h1>
          <span className="layout-tagline">Analise sua marca nas maiores LLMs e descubra seu Ranking</span>
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
