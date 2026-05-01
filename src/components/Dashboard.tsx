import { useState } from 'react';
import { LogOut, RefreshCw } from 'lucide-react';
import GlobalCounter from './GlobalCounter';
import MachineDistribution from './MachineDistribution';
import LatencyChart from './LatencyChart';
import BenchmarkDashboard from './BenchmarkDashboard';
import type { ConnectionConfig } from '../types';

interface DashboardProps {
  config: ConnectionConfig;
  onDisconnect: () => void;
}

export default function Dashboard({ config, onDisconnect }: DashboardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'monitoring' | 'benchmark'>('monitoring');

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header compact */}
      <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
        <div className="px-6 flex justify-between items-center py-2">
          <div className="flex items-center space-x-6">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Fauna Dashboard</h1>
              <p className="text-xs text-gray-500">{config.domain}:{config.port}</p>
            </div>
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('monitoring')}
                className={`px-4 py-1 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'monitoring' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600'
                }`}
              >
                Monitoring
              </button>
              <button
                onClick={() => setActiveTab('benchmark')}
                className={`px-4 py-1 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'benchmark' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600'
                }`}
              >
                Benchmark
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={handleRefresh} className="flex items-center space-x-1 px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Actualiser</span>
            </button>
            <button onClick={onDisconnect} className="flex items-center space-x-1 px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm">
              <LogOut className="w-3.5 h-3.5" />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="flex-1 overflow-hidden p-4">
        {activeTab === 'monitoring' && (
          <div className="h-full flex flex-col gap-3">
            {/* Ligne 1 : Compteur global */}
            <div className="flex-shrink-0">
              <GlobalCounter />
            </div>
            {/* Ligne 2 : Répartition + Latence côte à côte */}
            <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
              <div className="overflow-hidden">
                <MachineDistribution />
              </div>
              <div className="overflow-hidden">
                <LatencyChart />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'benchmark' && (
          <div className="h-full overflow-auto">
            <BenchmarkDashboard />
          </div>
        )}
      </main>
    </div>
  );
}
