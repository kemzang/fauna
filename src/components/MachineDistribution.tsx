import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, RadarChart,
  PolarGrid, PolarAngleAxis, Radar, Legend,
} from 'recharts';
import { Monitor, Globe, Cpu, MemoryStick, Wifi, Clock } from 'lucide-react';
import { getMachineStats } from '../services/fauna';
import type { MachineStats } from '../types';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const REGION_FLAGS: Record<string, string> = {
  Europe: '🇪🇺', Afrique: '🌍', Asie: '🌏', Amérique: '🌎',
  America: '🌎', Africa: '🌍', Asia: '🌏',
};

export default function MachineDistribution() {
  const [stats, setStats] = useState<MachineStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState<'documents' | 'cpu' | 'memory' | 'network' | 'latency'>('documents');

  useEffect(() => {
    const fetch = async () => {
      try {
        const s = await getMachineStats();
        setStats(s);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
    const interval = setInterval(fetch, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="bg-white rounded-xl p-6 shadow flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
    </div>
  );

  const barData = stats.map((s, i) => ({
    name: s.node.replace('PC', 'PC'),
    documents: s.count,
    cpu: parseFloat(s.avgCpu.toFixed(1)),
    memory: parseFloat(s.avgMemory.toFixed(1)),
    network: parseFloat(s.avgNetwork.toFixed(0)),
    latency: parseFloat(s.avgLatency.toFixed(1)),
    color: COLORS[i % COLORS.length],
  }));

  const radarData = stats.map(s => ({
    node: s.node,
    CPU: parseFloat(s.avgCpu.toFixed(1)),
    RAM: parseFloat(s.avgMemory.toFixed(1)),
    Réseau: parseFloat(((s.avgNetwork / 1000) * 100).toFixed(1)),
    Latence: parseFloat(((s.avgLatency / 150) * 100).toFixed(1)),
  }));

  const metricConfig = {
    documents: { label: 'Documents', color: '#6366f1', unit: 'docs', icon: Monitor },
    cpu: { label: 'CPU moyen', color: '#3b82f6', unit: '%', icon: Cpu },
    memory: { label: 'RAM moyenne', color: '#10b981', unit: '%', icon: MemoryStick },
    network: { label: 'Réseau moyen', color: '#f59e0b', unit: 'MB/s', icon: Wifi },
    latency: { label: 'Latence moyenne', color: '#ef4444', unit: 'ms', icon: Clock },
  };

  const cfg = metricConfig[activeMetric];
  const total = stats.reduce((s, m) => s + m.count, 0);

  return (
    <div className="bg-white rounded-xl shadow flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-indigo-600" />
          <span className="font-semibold text-gray-800 text-sm">Répartition par Machine</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Globe className="w-3.5 h-3.5" />
          <span>{stats.length} nœuds · {total.toLocaleString()} docs</span>
        </div>
      </div>

      {/* Sélecteur de métrique */}
      <div className="px-4 py-2 flex gap-1 flex-shrink-0">
        {(Object.keys(metricConfig) as Array<keyof typeof metricConfig>).map(key => {
          const Icon = metricConfig[key].icon;
          return (
            <button
              key={key}
              onClick={() => setActiveMetric(key)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                activeMetric === key
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-3 h-3" />
              {metricConfig[key].label}
            </button>
          );
        })}
      </div>

      {/* Graphiques */}
      <div className="flex-1 grid grid-cols-2 gap-2 px-4 pb-2 min-h-0">
        {/* Bar chart */}
        <div className="flex flex-col min-h-0">
          <div className="text-xs text-gray-500 mb-1 font-medium">{cfg.label} par machine</div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 4, right: 8, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v) => [`${v} ${cfg.unit}`, cfg.label]}
                  contentStyle={{ fontSize: 11 }}
                />
                <Bar dataKey={activeMetric} radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie chart (documents uniquement) ou Radar */}
        <div className="flex flex-col min-h-0">
          {activeMetric === 'documents' ? (
            <>
              <div className="text-xs text-gray-500 mb-1 font-medium">Distribution %</div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={barData}
                      dataKey="documents"
                      nameKey="name"
                      cx="50%" cy="50%"
                      outerRadius="70%"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {barData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [`${v} docs`]} contentStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <>
              <div className="text-xs text-gray-500 mb-1 font-medium">Profil système (normalisé)</div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={[
                    { metric: 'CPU', ...Object.fromEntries(stats.map(s => [s.node, s.avgCpu])) },
                    { metric: 'RAM', ...Object.fromEntries(stats.map(s => [s.node, s.avgMemory])) },
                    { metric: 'Réseau', ...Object.fromEntries(stats.map(s => [s.node, (s.avgNetwork / 1000) * 100])) },
                    { metric: 'Latence', ...Object.fromEntries(stats.map(s => [s.node, (s.avgLatency / 150) * 100])) },
                  ]}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                    {stats.map((s, i) => (
                      <Radar key={s.node} name={s.node} dataKey={s.node}
                        stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} />
                    ))}
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => [`${v.toFixed(1)}%`]} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tableau récapitulatif */}
      {stats.length > 0 && (
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)` }}>
            {stats.map((s, i) => (
              <div key={s.node} className="rounded-lg p-2 text-xs" style={{ backgroundColor: COLORS[i % COLORS.length] + '15', borderLeft: `3px solid ${COLORS[i % COLORS.length]}` }}>
                <div className="font-bold text-gray-800 flex items-center gap-1">
                  <span>{REGION_FLAGS[s.region] || '🖥️'}</span>
                  <span>{s.node}</span>
                </div>
                <div className="text-gray-500 mt-0.5">{s.region}</div>
                <div className="mt-1 space-y-0.5">
                  <div className="flex justify-between"><span className="text-gray-500">Docs</span><span className="font-semibold">{s.count.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">CPU</span><span className="font-semibold">{s.avgCpu.toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">RAM</span><span className="font-semibold">{s.avgMemory.toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Latence</span><span className={`font-semibold ${s.avgLatency > 100 ? 'text-red-600' : s.avgLatency > 50 ? 'text-yellow-600' : 'text-green-600'}`}>{s.avgLatency.toFixed(1)}ms</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 pb-4">
          <Monitor className="w-10 h-10 mb-2 text-gray-200" />
          <p className="text-sm">Aucune donnée — lancez les scripts d'injection</p>
        </div>
      )}
    </div>
  );
}
