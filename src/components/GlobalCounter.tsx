import { useEffect, useState, useRef } from 'react';
import { Database, Zap, Cpu, MemoryStick, Wifi, Activity } from 'lucide-react';
import { getTotalDocumentCount, getMachineStats } from '../services/fauna';
import type { MachineStats } from '../types';

function StatCard({ icon: Icon, label, value, unit, color, pct }: {
  icon: React.ElementType; label: string; value: string; unit?: string;
  color: string; pct?: number;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 bg-white/5 rounded-xl border border-white/10 min-w-[130px]">
      <div className="flex items-center gap-1.5">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <div className="flex items-end gap-1">
        <span className={`text-xl font-bold ${color}`}>{value}</span>
        {unit && <span className="text-xs text-slate-500 mb-0.5">{unit}</span>}
      </div>
      {pct !== undefined && (
        <div className="w-full bg-white/10 rounded-full h-1">
          <div className={`h-1 rounded-full transition-all duration-700 bg-current ${color}`}
            style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
    </div>
  );
}

export default function GlobalCounter() {
  const [count, setCount] = useState(0);
  const [docsPerSec, setDocsPerSec] = useState(0);
  const [stats, setStats] = useState<MachineStats[]>([]);
  const [pulse, setPulse] = useState(false);
  const prevRef = useRef({ count: 0, time: Date.now() });

  useEffect(() => {
    const run = async () => {
      const [c, s] = await Promise.all([getTotalDocumentCount(), getMachineStats()]);
      const now = Date.now();
      const dt = (now - prevRef.current.time) / 1000;
      const diff = c - prevRef.current.count;
      if (dt > 0 && diff > 0) { setDocsPerSec(Math.round(diff / dt)); setPulse(true); setTimeout(() => setPulse(false), 600); }
      prevRef.current = { count: c, time: now };
      setCount(c); setStats(s);
    };
    run();
    const t = setInterval(run, 1500);
    return () => clearInterval(t);
  }, []);

  const fmt = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toLocaleString();
  const avg = (fn: (s: MachineStats) => number) => stats.length ? stats.reduce((a, s) => a + fn(s), 0) / stats.length : 0;

  return (
    <div className="bg-linear-to-r from-indigo-900/60 to-purple-900/60 border border-indigo-500/30 rounded-2xl p-4 backdrop-blur-sm">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Compteur principal */}
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl bg-indigo-500/20 border border-indigo-500/40 transition-transform duration-300 ${pulse ? 'scale-110' : ''}`}>
            <Database className="w-7 h-7 text-indigo-400" />
          </div>
          <div>
            <p className="text-xs text-indigo-300 font-medium uppercase tracking-wider">Documents Total</p>
            <p className={`text-4xl font-black tracking-tight transition-colors duration-300 ${pulse ? 'text-yellow-300' : 'text-white'}`}>
              {fmt(count)}
            </p>
            <p className="text-xs text-slate-400">collection Telemetry · {stats.length} nœud{stats.length > 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="w-px h-14 bg-white/10 hidden sm:block" />

        {/* Débit */}
        <div className="flex items-center gap-2">
          <Zap className={`w-5 h-5 ${docsPerSec > 0 ? 'text-yellow-400 animate-pulse' : 'text-slate-500'}`} />
          <div>
            <p className="text-xs text-slate-400">Débit</p>
            <p className="text-2xl font-bold text-white">{docsPerSec}<span className="text-sm font-normal text-slate-400 ml-1">docs/s</span></p>
          </div>
        </div>

        <div className="w-px h-14 bg-white/10 hidden sm:block" />

        {/* Métriques système */}
        <div className="flex gap-2 flex-wrap flex-1">
          <StatCard icon={Cpu} label="CPU moyen" value={avg(s => s.avgCpu).toFixed(1)} unit="%" color="text-blue-400" pct={avg(s => s.avgCpu)} />
          <StatCard icon={MemoryStick} label="RAM moyenne" value={avg(s => s.avgMemory).toFixed(1)} unit="%" color="text-emerald-400" pct={avg(s => s.avgMemory)} />
          <StatCard icon={Wifi} label="Réseau moy." value={avg(s => s.avgNetwork).toFixed(0)} unit="MB/s" color="text-orange-400" pct={avg(s => s.avgNetwork) / 10} />
          <StatCard icon={Activity} label="Latence moy." value={avg(s => s.avgLatency).toFixed(1)} unit="ms"
            color={avg(s => s.avgLatency) > 100 ? 'text-red-400' : avg(s => s.avgLatency) > 50 ? 'text-yellow-400' : 'text-emerald-400'}
            pct={avg(s => s.avgLatency) / 1.5} />
        </div>
      </div>
    </div>
  );
}
