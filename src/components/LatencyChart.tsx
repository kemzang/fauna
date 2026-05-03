import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Clock, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { getLatencyData } from '../services/fauna';
import type { LatencyData } from '../types';

const NODE_COLORS: Record<string, string> = { PC1: '#6366f1', PC2: '#10b981', PC3: '#f59e0b', PC4: '#ef4444', PC5: '#8b5cf6' };
const getColor = (node: string) => { for (const k of Object.keys(NODE_COLORS)) { if (node.includes(k)) return NODE_COLORS[k]; } return '#6366f1'; };

const darkTooltip = {
  contentStyle: { background: '#1e2130', border: '1px solid #334155', borderRadius: 8, fontSize: 11, color: '#e2e8f0' },
};

export default function LatencyChart() {
  const [raw, setRaw] = useState<LatencyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => { try { setRaw(await getLatencyData(200)); } finally { setLoading(false); } };
    run(); const t = setInterval(run, 2000); return () => clearInterval(t);
  }, []);

  const nodes = [...new Set(raw.map(d => d.node))].sort();
  const buckets: Record<string, Record<string, number[]>> = {};
  raw.forEach(d => {
    const key = new Date(Math.floor(d.timestamp / 1000) * 1000).toLocaleTimeString('fr-FR');
    if (!buckets[key]) buckets[key] = {};
    if (!buckets[key][d.node]) buckets[key][d.node] = [];
    buckets[key][d.node].push(d.latency);
  });
  const chartData = Object.entries(buckets).slice(-60).map(([time, nm]) => {
    const pt: Record<string, number | string> = { time };
    nodes.forEach(n => { const v = nm[n]; if (v?.length) pt[n] = +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1); });
    return pt;
  });

  const all = raw.map(d => d.latency).sort((a, b) => a - b);
  const avg = all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
  const p95 = all.length ? all[Math.floor(all.length * 0.95)] : 0;
  const p99 = all.length ? all[Math.floor(all.length * 0.99)] : 0;
  const max = all.length ? all[all.length - 1] : 0;
  const min = all.length ? all[0] : 0;

  const status = avg < 50 ? { label: 'Excellent', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', Icon: TrendingDown }
    : avg < 100 ? { label: 'Bon', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', Icon: TrendingUp }
    : { label: 'Élevé', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', Icon: AlertTriangle };

  const kpis = [
    { label: 'Moyenne', value: avg.toFixed(1), color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: 'Min', value: min.toFixed(1), color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Max', value: max.toFixed(1), color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'P95', value: p95.toFixed(1), color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'P99', value: p99.toFixed(1), color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

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
          <Clock className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-white text-sm">Latence en Temps Réel</span>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${status.bg} ${status.color}`}>
          <status.Icon className="w-3 h-3" />{status.label}
        </div>
      </div>

      {/* KPIs */}
      <div className="px-4 py-2.5 grid grid-cols-5 gap-2">
        {kpis.map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl px-3 py-2 text-center border border-white/5`}>
            <p className="text-xs text-slate-400">{k.label}</p>
            <p className={`text-base font-bold ${k.color}`}>{k.value}<span className="text-xs font-normal text-slate-500 ml-0.5">ms</span></p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="flex-1 px-4 pb-3 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} unit="ms" />
            <Tooltip {...darkTooltip} formatter={(v: number) => [`${v}ms`]} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            {p95 > 0 && <ReferenceLine y={p95} stroke="#f97316" strokeDasharray="4 2"
              label={{ value: `P95`, position: 'insideTopRight', fontSize: 9, fill: '#f97316' }} />}
            {nodes.map(n => (
              <Line key={n} type="monotone" dataKey={n} stroke={getColor(n)}
                strokeWidth={2} dot={false} connectNulls name={n} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {raw.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 pb-6">
          <Clock className="w-10 h-10 mb-2 text-slate-700" />
          <p className="text-sm">Lancez les scripts d'injection</p>
        </div>
      )}
    </div>
  );
}
