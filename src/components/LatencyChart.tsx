import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Clock, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { getLatencyData } from '../services/fauna';
import type { LatencyData } from '../types';

const NODE_COLORS: Record<string, string> = {
  PC1: '#6366f1', PC2: '#10b981', PC3: '#f59e0b',
  PC4: '#ef4444', PC5: '#8b5cf6',
};
const getColor = (node: string) => {
  for (const key of Object.keys(NODE_COLORS)) {
    if (node.includes(key)) return NODE_COLORS[key];
  }
  return '#6366f1';
};

export default function LatencyChart() {
  const [rawData, setRawData] = useState<LatencyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getLatencyData(200);
        setRawData(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const nodes = [...new Set(rawData.map(d => d.node))].sort();

  // Groupe par seconde
  const buckets: Record<string, Record<string, number[]>> = {};
  rawData.forEach(d => {
    const key = new Date(Math.floor(d.timestamp / 1000) * 1000).toLocaleTimeString('fr-FR');
    if (!buckets[key]) buckets[key] = {};
    if (!buckets[key][d.node]) buckets[key][d.node] = [];
    buckets[key][d.node].push(d.latency);
  });

  const chartData = Object.entries(buckets).slice(-60).map(([time, nodeMap]) => {
    const point: Record<string, number | string> = { time };
    nodes.forEach(node => {
      const vals = nodeMap[node];
      if (vals?.length) point[node] = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
    });
    return point;
  });

  const allLat = rawData.map(d => d.latency).sort((a, b) => a - b);
  const avg = allLat.length ? allLat.reduce((a, b) => a + b, 0) / allLat.length : 0;
  const p95 = allLat.length ? allLat[Math.floor(allLat.length * 0.95)] : 0;
  const p99 = allLat.length ? allLat[Math.floor(allLat.length * 0.99)] : 0;
  const maxLat = allLat.length ? allLat[allLat.length - 1] : 0;
  const minLat = allLat.length ? allLat[0] : 0;

  const status = avg < 50 ? 'excellent' : avg < 100 ? 'bon' : 'élevé';
  const statusColor = avg < 50 ? 'text-green-600' : avg < 100 ? 'text-yellow-600' : 'text-red-600';
  const statusBg = avg < 50 ? 'bg-green-50 border-green-200' : avg < 100 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

  const kpis = [
    { label: 'Moyenne', value: `${avg.toFixed(1)}ms`, color: 'text-indigo-700', bg: 'bg-indigo-50' },
    { label: 'Min', value: `${minLat.toFixed(1)}ms`, color: 'text-green-700', bg: 'bg-green-50' },
    { label: 'Max', value: `${maxLat.toFixed(1)}ms`, color: 'text-red-700', bg: 'bg-red-50' },
    { label: 'P95', value: `${p95.toFixed(1)}ms`, color: 'text-orange-700', bg: 'bg-orange-50' },
    { label: 'P99', value: `${p99.toFixed(1)}ms`, color: 'text-purple-700', bg: 'bg-purple-50' },
  ];

  return (
    <div className="bg-white rounded-xl shadow flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600" />
          <span className="font-semibold text-gray-800 text-sm">Latence en Temps Réel</span>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${statusBg} ${statusColor}`}>
          {avg < 50 ? <TrendingDown className="w-3 h-3" /> : avg < 100 ? <TrendingUp className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
          {status}
        </div>
      </div>

      {/* KPIs */}
      <div className="px-4 py-2 grid grid-cols-5 gap-2 flex-shrink-0">
        {kpis.map(kpi => (
          <div key={kpi.label} className={`${kpi.bg} rounded-lg px-2 py-1.5 text-center`}>
            <div className="text-xs text-gray-500">{kpi.label}</div>
            <div className={`text-sm font-bold ${kpi.color}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Graphique */}
      <div className="flex-1 px-4 pb-2 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="time" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} unit="ms" />
            <Tooltip
              contentStyle={{ fontSize: 11 }}
              formatter={(v: number) => [`${v}ms`]}
            />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            {/* Ligne de référence P95 */}
            {p95 > 0 && (
              <ReferenceLine y={p95} stroke="#f97316" strokeDasharray="4 2"
                label={{ value: `P95 ${p95.toFixed(0)}ms`, position: 'right', fontSize: 9, fill: '#f97316' }} />
            )}
            {nodes.map(node => (
              <Line
                key={node}
                type="monotone"
                dataKey={node}
                stroke={getColor(node)}
                strokeWidth={2}
                dot={false}
                connectNulls
                name={node}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {rawData.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 pb-4">
          <Clock className="w-10 h-10 mb-2 text-gray-200" />
          <p className="text-sm">Aucune donnée — lancez les scripts d'injection</p>
        </div>
      )}
    </div>
  );
}
