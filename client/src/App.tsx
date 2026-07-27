import { Route, Routes } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Dashboard } from '@/pages/Dashboard';
import { PairsIndex } from '@/pages/PairsIndex';
import { PairAnalysis } from '@/pages/PairAnalysis';
import { CentralBanks } from '@/pages/CentralBanks';
import { EconomicCalendar } from '@/pages/EconomicCalendar';
import { NewsCalendar } from '@/pages/NewsCalendar';
import { Correlation } from '@/pages/Correlation';
import { Terminal } from '@/pages/Terminal';

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/terminal" element={<Terminal />} />
          <Route path="/pairs" element={<PairsIndex />} />
          <Route path="/pairs/:pair" element={<PairAnalysis />} />
          <Route path="/central-banks" element={<CentralBanks />} />
          <Route path="/calendar" element={<EconomicCalendar />} />
          <Route path="/news" element={<NewsCalendar />} />
          <Route path="/correlation" element={<Correlation />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
