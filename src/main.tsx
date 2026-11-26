import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { Layout } from './ui/components/Layout';
import { ImpiantiPage } from './ui/pages/ImpiantiPage';
import { ImpiantoPage } from './ui/pages/ImpiantoPage';
import { CentralePage } from './ui/pages/CentralePage';
import { RetePage } from './ui/pages/RetePage';
import { LoopPage } from './ui/pages/LoopPage';
import { ImpostazioniPage } from './ui/pages/ImpostazioniPage';
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
          <Route path="/" element={<ImpiantiPage />} />
          <Route path="/impianto/:id" element={<ImpiantoPage />} />
          <Route path="/impianto/:id/rete" element={<RetePage />} />
          <Route path="/centrale/:id" element={<CentralePage />} />
          <Route path="/loop/:id" element={<LoopPage />} />
          <Route path="/impostazioni" element={<ImpostazioniPage />} />
          <Route path="*" element={<ImpiantiPage />} />
        </Routes>
      </Layout>
    </HashRouter>
    </Accesso>
  </StrictMode>,
);
