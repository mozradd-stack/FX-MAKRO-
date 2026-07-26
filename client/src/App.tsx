import { Route, Routes } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Dashboard } from '@/pages/Dashboard';
import { PairsIndex } from '@/pages/PairsIndex';
import { PairAnalysis } from '@/pages/PairAnalysis';
import { CentralBanks } from '@/pages/CentralBanks';
import { EconomicCalendar } from '@/pages/EconomicCalendar';
import { SettingsPage } from '@/pages/Settings';

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pairs" element={<PairsIndex />} />
          <Route path="/pairs/:pair" element={<PairAnalysis />} />
          <Route path="/central-banks" element={<CentralBanks />} />
          <Route path="/calendar" element={<EconomicCalendar />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
