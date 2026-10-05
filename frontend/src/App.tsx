import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SystemProvider } from '@/context/SystemContext';
import { ViewModeProvider } from '@/context/ViewModeContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardPage, LabPage, ScenariosPage } from '@/pages/Pages';
import {
  SimulationsPage, SimulationDetailPage,
  DetectionsPage, DetectionDetailPage,
  LogsPage, LogDetailPage,
  AttackMatrixPage, CoveragePage,
  AgentsPage, InfrastructurePage,
  BlueTeamPage, InvestigationsPage,
  SettingsPage,
} from '@/pages/Pages2';

function App() {
  return (
    <SystemProvider>
      <ViewModeProvider>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />

              {/* Red Team */}
              <Route path="/red-team/lab" element={<LabPage />} />
              <Route path="/red-team/scenarios" element={<ScenariosPage />} />
              <Route path="/red-team/simulations" element={<SimulationsPage />} />
              <Route path="/red-team/simulations/:id" element={<SimulationDetailPage />} />

              {/* Blue Team */}
              <Route path="/blue-team/detections" element={<DetectionsPage />} />
              <Route path="/blue-team/detections/:id" element={<DetectionDetailPage />} />
              <Route path="/blue-team/logs" element={<LogsPage />} />
              <Route path="/blue-team/logs/:id" element={<LogDetailPage />} />
              <Route path="/blue-team/investigations" element={<InvestigationsPage />} />

              {/* ATT&CK */}
              <Route path="/attack/matrix" element={<AttackMatrixPage />} />
              <Route path="/attack/coverage" element={<CoveragePage />} />

              {/* Lab */}
              <Route path="/lab/agents" element={<AgentsPage />} />
              <Route path="/lab/infrastructure" element={<InfrastructurePage />} />

              {/* Blue Team (combined) */}
              <Route path="/blue-team" element={<BlueTeamPage />} />

              {/* Settings */}
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </ViewModeProvider>
    </SystemProvider>
  );
}

export default App;
