import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Monitor, Globe, Cpu, MemoryStick, Wifi, Clock } from 'lucide-react';
import { getMachineStats } from '../services/fauna';
import type { MachineStats } from '../types';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const FLAGS: Record<string, string> = { Europe: '🇪🇺', Afrique: '🌍', Asie: '🌏', Amérique: '🌎', America: '🌎', Africa: '🌍', Asia: '🌏' };

type Metric = 'documents' | 'cpu' | 'memory' | 'network' | 'latency';
const METRICS: { key: Metric; label: string; unit: string; icon: React.ElementType; color: string }[] = [
  { key: 'documents', label: 'Documents', unit: 'docs', icon: Monitor, color: '#6366f1' },
  { key: 'cpu', label: 'CPU', unit: '%', icon: Cpu, color: '#3b82f6' },
  { key: 'memory', label: 'RAM', unit: '%', icon: MemoryStick, color: '#10b981' },
  { key: 'network', label: 'Réseau', unit: 'MB/s', icon: Wifi, color: '#f59e0b' },
  { key: 'latency', label: 'Latence', unit: 'ms', icon: Clock, color: '#ef4444' },
];

const darkTooltip = {
  contentStyle: { background: '#1e2130', border: '1px solid #334155', borderRadius: 8, fontSize: 12, color: '#e2e8f0' },
  cursor: { fill: 'rgba(255,255,255,0.05)' },
};

export default function MachineDistribution() {
  const [stats, setStats] = useState<MachineStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<Metric>('documents');

  useEffect(() => {
    const run = async () => { try { setStats(await getMachineStats()); } finally { setLoading(false); } };
    run(); const t = setInterval(run, 3000); return () => clearInterval(t);
  }, []);

  const cfg = METRICS.find(m => m.key === metric)!;
  const barData = stats.map((s, i) => ({
    name: s.node, color: COLORS[i % COLORS.length],
    documents: s.count, cpu: +s.avgCpu.toFixed(1),
    memory: +s.avgMemory.toFixed(1), network: +s.avgNetwork.toFixed(0),
    latency: +s.avgLatency.toFixed(1),
  }));

  if (loading) return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
    </div>
  );

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl flex flex-col h-full overflow-hidden backdrop-blur-sm">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-white text-sm">Répartition par Machine</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Globe className="w-3.5 h-3.5" />
          <span>{stats.length} nœuds · {stats.reduce((a, s) => a + s.count, 0).toLocaleString()} docs</span>
        </div>
      </div>

      {/* Metric tabs */}
      <div className="px-4 py-2 flex gap-1 border-b border-slate-700/30">
        {METRICS.map(m => {
          const Icon = m.icon;
          return (
            <button key={m.key} onClick={() => setMetric(m.key)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${metric === m.key ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
              <Icon className="w-3 h-3" />{m.label}
            </button>
          );
        })}
      </div>

      {/* Charts */}
      <div className="flex-1 grid grid-cols-2 gap-0 min-h-0 p-3">
        {/* Bar */}
        <div className="flex flex-col min-h-0">
          <p className="text-xs text-slate-400 mb-1 font-medium">{cfg.label} par machine</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 4, right: 4, left: -15, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-20} textAnchor="end" />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <Tooltip {...darkTooltip} formatter={(v: number) => [`${v} ${cfg.unit}`, cfg.label]} />
                <Bar dataKey={metric} radius={[4, 4, 0, 0]}>
                  {barData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie */}
        <div className="flex flex-col min-h-0">
          <p className="text-xs text-slate-400 mb-1 font-medium">Distribution %</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={barData} dataKey={metric} nameKey="name"
                  cx="50%" cy="45%" outerRadius="60%" innerRadius="30%"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: '#475569', strokeWidth: 1 }}>
                  {barData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...darkTooltip} formatter={(v: number) => [`${v} ${cfg.unit}`]} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Node cards */}
      {stats.length > 0 && (
        <div className="px-3 pb-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)` }}>
          {stats.map((s, i) => (
            <div key={s.node} className="rounded-xl p-2.5 border text-xs"
              style={{ background: COLORS[i % COLORS.length] + '15', borderColor: COLORS[i % COLORS.length] + '40' }}>
              <div className="font-bold text-white flex items-center gap-1 mb-1.5">
                <span>{FLAGS[s.region] || '🖥️'}</span><span>{s.node}</span>
                <span className="ml-auto text-slate-400 font-normal">{s.region}</span>
              </div>
              <div className="space-y-0.5 text-slate-300">
                <div className="flex justify-between"><span className="text-slate-500">Docs</span><span className="font-semibold text-white">{s.count.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">CPU</span><span>{s.avgCpu.toFixed(1)}%</span></div>
                <div className="flex justify-between"><span className="text-slate-500">RAM</span><span>{s.avgMemory.toFixed(1)}%</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Latence</span>
                  <span className={s.avgLatency > 100 ? 'text-red-400' : s.avgLatency > 50 ? 'text-yellow-400' : 'text-emerald-400'}>
                    {s.avgLatency.toFixed(1)}ms
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {stats.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 pb-6">
          <Monitor className="w-10 h-10 mb-2 text-slate-700" />
          <p className="text-sm">Lancez les scripts d'injection</p>
        </div>
      )}
    </div>
  );
}
