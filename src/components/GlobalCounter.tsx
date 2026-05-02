import { useEffect, useState, useRef } from 'react';
import { Database, Zap, Cpu, MemoryStick, Wifi, Activity } from 'lucide-react';
import { getTotalDocumentCount, getMachineStats } from '../services/fauna';
import type { MachineStats } from '../types';

export default function GlobalCounter() {
  const [count, setCount] = useState(0);
  const [docsPerSec, setDocsPerSec] = useState(0);
  const [stats, setStats] = useState<MachineStats[]>([]);
  const [isIncreasing, setIsIncreasing] = useState(false);
  const prevCountRef = useRef(0);
  const prevTimeRef = useRef(Date.now());

  useEffect(() => {
    const fetchAll = async () => {
      const [currentCount, machineStats] = await Promise.all([
        getTotalDocumentCount(),
        getMachineStats(),
      ]);

      const now = Date.now();
      const elapsed = (now - prevTimeRef.current) / 1000;
      const diff = currentCount - prevCountRef.current;
      if (elapsed > 0 && diff > 0) {
        setDocsPerSec(Math.round(diff / elapsed));
        setIsIncreasing(true);
        setTimeout(() => setIsIncreasing(false), 600);
      }
      prevCountRef.current = currentCount;
      prevTimeRef.current = now;
      setCount(currentCount);
      setStats(machineStats);
    };

    fetchAll();
    const interval = setInterval(fetchAll, 1500);
    return () => clearInterval(interval);
  }, []);

  const fmt = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
  };

  const avgCpu = stats.length > 0 ? stats.reduce((s, m) => s + m.avgCpu, 0) / stats.length : 0;
  const avgMem = stats.length > 0 ? stats.reduce((s, m) => s + m.avgMemory, 0) / stats.length : 0;
  const avgNet = stats.length > 0 ? stats.reduce((s, m) => s + m.avgNetwork, 0) / stats.length : 0;
  const avgLat = stats.length > 0 ? stats.reduce((s, m) => s + m.avgLatency, 0) / stats.length : 0;

  const MetricBar = ({ value, max, color }: { value: number; max: number; color: string }) => (
    <div className="w-full bg-white/20 rounded-full h-1.5 mt-1">
      <div
        className={`h-1.5 rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
      />
    </div>
  );

  return (
    <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 rounded-xl px-5 py-3 text-white shadow-lg">
      <div className="flex items-center gap-6">

        {/* Compteur principal */}
        <div className="flex items-center gap-3 min-w-[180px]">
          <div className={`p-2 bg-white/10 rounded-lg transition-transform duration-300 ${isIncreasing ? 'scale-110' : ''}`}>
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-indigo-200 font-medium">Documents total</div>
            <div className={`text-3xl font-bold tracking-tight transition-all duration-300 ${isIncreasing ? 'text-yellow-300' : 'text-white'}`}>
              {fmt(count)}
            </div>
            <div className="text-xs text-indigo-300">collection Telemetry</div>
          </div>
        </div>

        {/* Séparateur */}
        <div className="w-px h-12 bg-white/20" />

        {/* Débit */}
        <div className="flex items-center gap-2 min-w-[110px]">
          <Zap className={`w-5 h-5 ${docsPerSec > 0 ? 'text-yellow-300 animate-pulse' : 'text-indigo-300'}`} />
          <div>
            <div className="text-xs text-indigo-200">Débit</div>
            <div className="text-xl font-bold">{docsPerSec}<span className="text-sm font-normal text-indigo-300"> docs/s</span></div>
            <div className="text-xs text-indigo-300">{stats.length} nœuds actifs</div>
          </div>
        </div>

        {/* Séparateur */}
        <div className="w-px h-12 bg-white/20" />

        {/* CPU */}
        <div className="flex-1 min-w-[100px]">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Cpu className="w-3.5 h-3.5 text-blue-300" />
            <span className="text-xs text-indigo-200">CPU moyen</span>
            <span className="ml-auto text-sm font-bold">{avgCpu.toFixed(1)}%</span>
          </div>
          <MetricBar value={avgCpu} max={100} color="bg-blue-400" />
        </div>

        {/* RAM */}
        <div className="flex-1 min-w-[100px]">
          <div className="flex items-center gap-1.5 mb-0.5">
            <MemoryStick className="w-3.5 h-3.5 text-green-300" />
            <span className="text-xs text-indigo-200">RAM moyenne</span>
            <span className="ml-auto text-sm font-bold">{avgMem.toFixed(1)}%</span>
          </div>
          <MetricBar value={avgMem} max={100} color="bg-green-400" />
        </div>

        {/* Réseau */}
        <div className="flex-1 min-w-[110px]">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Wifi className="w-3.5 h-3.5 text-orange-300" />
            <span className="text-xs text-indigo-200">Réseau moy.</span>
            <span className="ml-auto text-sm font-bold">{avgNet.toFixed(0)} MB/s</span>
          </div>
          <MetricBar value={avgNet} max={1000} color="bg-orange-400" />
        </div>

        {/* Latence */}
        <div className="flex-1 min-w-[100px]">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Activity className="w-3.5 h-3.5 text-pink-300" />
            <span className="text-xs text-indigo-200">Latence moy.</span>
            <span className={`ml-auto text-sm font-bold ${avgLat > 100 ? 'text-red-300' : avgLat > 50 ? 'text-yellow-300' : 'text-green-300'}`}>
              {avgLat.toFixed(1)}ms
            </span>
          </div>
          <MetricBar value={avgLat} max={150} color={avgLat > 100 ? 'bg-red-400' : avgLat > 50 ? 'bg-yellow-400' : 'bg-green-400'} />
        </div>

      </div>
    </div>
  );
}
