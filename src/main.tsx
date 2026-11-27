import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { Layout } from './ui/components/Layout';
import { ImpiantiPage } from './ui/pages/ImpiantiPage';
import { HomePage } from './ui/pages/HomePage';
import { ImpiantoPage } from './ui/pages/ImpiantoPage';
import { CentralePage } from './ui/pages/CentralePage';
import { RetePage } from './ui/pages/RetePage';
import { LoopPage } from './ui/pages/LoopPage';
import { ImpostazioniPage } from './ui/pages/ImpostazioniPage';
import { SessionePage } from './ui/sessione/SessionePage';
import { GuidaPage } from './ui/sessione/GuidaPage';
import { LetturaPage } from './ui/pol/LetturaPage';
import { Accesso } from './ui/Accesso';
import './styles.css';

registerSW({ immediate: true });
// Chiede al browser di non cancellare l'archivio locale quando manca spazio.
navigator.storage?.persist?.().catch(() => undefined);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Accesso>
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/impianti" element={<ImpiantiPage />} />
          <Route path="/impianto/:id" element={<ImpiantoPage />} />
          <Route path="/impianto/:id/rete" element={<RetePage />} />
          <Route path="/centrale/:id" element={<CentralePage />} />
          <Route path="/loop/:id" element={<LoopPage />} />
          <Route path="/sessione/:id" element={<SessionePage />} />
          <Route path="/sessione/:id/guida/:passo" element={<GuidaPage />} />
          <Route path="/sessione/:id/lettura/:lid" element={<LetturaPage />} />
          <Route path="/impostazioni" element={<ImpostazioniPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </Layout>
    </HashRouter>
    </Accesso>
  </StrictMode>,
);
