import { useState } from 'react';
import { LogOut, RefreshCw, LayoutDashboard, BarChart3 } from 'lucide-react';
import GlobalCounter from './GlobalCounter';
import MachineDistribution from './MachineDistribution';
import LatencyChart from './LatencyChart';
import BenchmarkDashboard from './BenchmarkDashboard';
import type { ConnectionConfig } from '../types';

interface Props { config: ConnectionConfig; onDisconnect: () => void; }

export default function Dashboard({ config, onDisconnect }: Props) {
  const [tab, setTab] = useState<'monitoring' | 'benchmark'>('monitoring');
  const [spin, setSpin] = useState(false);

  const refresh = () => { setSpin(true); setTimeout(() => setSpin(false), 1000); };

  return (
    <div className="h-screen flex flex-col bg-[#0f1117] overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
              <span className="text-indigo-400 font-black text-sm">F</span>
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">Fauna Dashboard</p>
              <p className="text-xs text-slate-500 leading-none mt-0.5">{config.domain}:{config.port}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-slate-800/80 rounded-xl p-1 border border-slate-700/50">
            <button onClick={() => setTab('monitoring')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'monitoring' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}>
              <LayoutDashboard className="w-3.5 h-3.5" />Monitoring
            </button>
            <button onClick={() => setTab('benchmark')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'benchmark' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}>
              <BarChart3 className="w-3.5 h-3.5" />Benchmark
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={refresh} className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-sm transition-colors border border-transparent hover:border-slate-700">
            <RefreshCw className={`w-3.5 h-3.5 ${spin ? 'animate-spin' : ''}`} />Actualiser
          </button>
          <button onClick={onDisconnect} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm transition-colors border border-red-500/20">
            <LogOut className="w-3.5 h-3.5" />Déconnexion
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden p-4">
        {tab === 'monitoring' && (
          <div className="h-full flex flex-col gap-3">
            {/* Top bar */}
            <div className="shrink-0">
              <GlobalCounter />
            </div>
            {/* Main grid */}
            <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
              <MachineDistribution />
              <LatencyChart />
            </div>
          </div>
        )}

        {tab === 'benchmark' && (
          <div className="h-full overflow-y-auto pr-1 space-y-4 pb-4">
            <BenchmarkDashboard />
          </div>
        )}
      </main>
    </div>
  );
}
