import { useState, useEffect, useRef } from 'react';
import { LogOut, RefreshCw, Database, Zap, Cpu, MemoryStick, Wifi, Activity, Monitor, Globe, Clock, TrendingUp, TrendingDown, AlertTriangle, Users } from 'lucide-react';
import { getMachineStats, getTotalDocumentCount, getLatencyData, getCouchDBDocCount, getCouchDBAvgLatency, initializeCouchDB } from '../services/fauna';
import type { ConnectionConfig, MachineStats, LatencyData } from '../types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, ReferenceLine,
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const REGION_FLAGS: Record<string, string> = {
  Europe: '🇪🇺', Afrique: '🌍', Asie: '🌏', Amérique: '🌎',
  America: '🌎', Africa: '🌍', Asia: '🌏',
};

interface DashboardProps {
  config: ConnectionConfig;
  onDisconnect: () => void;
}

export default function Dashboard({ config, onDisconnect }: DashboardProps) {
  const [faunaCount, setFaunaCount] = useState(0);
  const [couchCount, setCouchCount] = useState(0);
  const [faunaLatency, setFaunaLatency] = useState(0);
  const [couchLatency, setCouchLatency] = useState(0);
  const [machineStats, setMachineStats] = useState<MachineStats[]>([]);
  const [latencyHistory, setLatencyHistory] = useState<LatencyData[]>([]);
  const [docsPerSec, setDocsPerSec] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const prevCountRef = useRef(0);
  const prevTimeRef = useRef(Date.now());

  // Init CouchDB
  useEffect(() => {
    initializeCouchDB(config.domain, 5984, 'admin', 'admin');
  }, [config]);

  useEffect(() => {
    if (!isLive) return;
    const fetchAll = async () => {
      const [fc, cc, cl, ms, ld] = await Promise.all([
        getTotalDocumentCount(),
        getCouchDBDocCount(),
        getCouchDBAvgLatency(),
        getMachineStats(),
        getLatencyData(300),
      ]);

      const now = Date.now();
      const elapsed = (now - prevTimeRef.current) / 1000;
      const diff = fc - prevCountRef.current;
      if (elapsed > 0 && diff > 0) setDocsPerSec(Math.round(diff / elapsed));
      prevCountRef.current = fc;
      prevTimeRef.current = now;

      setFaunaCount(fc);
      setCouchCount(cc);
      setCouchLatency(cl);
      setMachineStats(ms);
      setLatencyHistory(ld);

      // Latence Fauna moyenne
      if (ld.length > 0) {
        const avg = ld.reduce((s, d) => s + d.latency, 0) / ld.length;
        setFaunaLatency(avg);
      }
    };
    fetchAll();
    const interval = setInterval(fetchAll, 2000);
    return () => clearInterval(interval);
  }, [isLive]);

  const fmt = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
  };

  const avgCpu = machineStats.length > 0 ? machineStats.reduce((s, m) => s + m.avgCpu, 0) / machineStats.length : 0;
  const avgMem = machineStats.length > 0 ? machineStats.reduce((s, m) => s + m.avgMemory, 0) / machineStats.length : 0;
  const avgNet = machineStats.length > 0 ? machineStats.reduce((s, m) => s + m.avgNetwork, 0) / machineStats.length : 0;

  // Données graphique latence
  const nodes = [...new Set(latencyHistory.map(d => d.node))].sort();
  const buckets: Record<string, Record<string, number[]>> = {};
  latencyHistory.forEach(d => {
    const key = new Date(Math.floor(d.timestamp / 2000) * 2000).toLocaleTimeString('fr-FR');
    if (!buckets[key]) buckets[key] = {};
    if (!buckets[key][d.node]) buckets[key][d.node] = [];
    buckets[key][d.node].push(d.latency);
  });
  const latencyChartData = Object.entries(buckets).slice(-40).map(([time, nodeMap]) => {
    const point: Record<string, number | string> = { time };
    nodes.forEach(node => {
      const vals = nodeMap[node];
      if (vals?.length) point[node] = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
    });
    return point;
  });

  const allLat = latencyHistory.map(d => d.latency).sort((a, b) => a - b);
  const p95 = allLat.length ? allLat[Math.floor(allLat.length * 0.95)] : 0;
  const p99 = allLat.length ? allLat[Math.floor(allLat.length * 0.99)] : 0;

  const latStatus = faunaLatency < 50 ? 'Excellent' : faunaLatency < 100 ? 'Bon' : 'Élevé';
  const latColor = faunaLatency < 50 ? '#10b981' : faunaLatency < 100 ? '#f59e0b' : '#ef4444';

  // Données comparaison
  const comparisonData = [
    { name: 'Documents', fauna: faunaCount, couch: couchCount },
  ];
  const latCompData = [
    { name: 'Latence moy.', fauna: parseFloat(faunaLatency.toFixed(1)), couch: parseFloat(couchLatency.toFixed(1)) },
  ];

  const MetricBar = ({ value, max, color }: { value: number; max: number; color: string }) => (
    <div className="w-full bg-white/10 rounded-full h-1.5 mt-1">
      <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color }} />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* ── Header ── */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">Fauna Dashboard</div>
              <div className="text-xs text-gray-400">{config.domain}:{config.port}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-green-900/40 border border-green-700/50 rounded-full">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-green-400 font-medium">Live</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLive(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isLive ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            {isLive ? '⏸ Pause' : '▶ Reprendre'}
          </button>
          <button onClick={onDisconnect} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            Déconnexion
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4 overflow-auto">

        {/* ── Ligne 1 : KPIs globaux ── */}
        <div className="grid grid-cols-6 gap-3">
          {/* Docs Fauna */}
          <div className="col-span-2 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-xl">
              <Database className="w-7 h-7" />
            </div>
            <div>
              <div className="text-xs text-indigo-200 font-medium uppercase tracking-wide">Documents Fauna</div>
              <div className="text-4xl font-black tracking-tight">{fmt(faunaCount)}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <Zap className={`w-3.5 h-3.5 ${docsPerSec > 0 ? 'text-yellow-300' : 'text-indigo-300'}`} />
                <span className="text-sm text-indigo-200">{docsPerSec} docs/s · {machineStats.length} nœuds</span>
              </div>
            </div>
          </div>

          {/* CPU */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-400 font-medium">CPU moyen</span>
            </div>
            <div className="text-2xl font-bold text-blue-400">{avgCpu.toFixed(1)}<span className="text-sm text-gray-500">%</span></div>
            <MetricBar value={avgCpu} max={100} color="#60a5fa" />
          </div>

          {/* RAM */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <MemoryStick className="w-4 h-4 text-green-400" />
              <span className="text-xs text-gray-400 font-medium">RAM moyenne</span>
            </div>
            <div className="text-2xl font-bold text-green-400">{avgMem.toFixed(1)}<span className="text-sm text-gray-500">%</span></div>
            <MetricBar value={avgMem} max={100} color="#34d399" />
          </div>

          {/* Réseau */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wifi className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-gray-400 font-medium">Réseau moy.</span>
            </div>
            <div className="text-2xl font-bold text-orange-400">{avgNet.toFixed(0)}<span className="text-sm text-gray-500"> MB/s</span></div>
            <MetricBar value={avgNet} max={1000} color="#fb923c" />
          </div>

          {/* Latence */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4" style={{ color: latColor }} />
              <span className="text-xs text-gray-400 font-medium">Latence moy.</span>
              <span className="ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ color: latColor, backgroundColor: latColor + '20' }}>{latStatus}</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: latColor }}>{faunaLatency.toFixed(1)}<span className="text-sm text-gray-500">ms</span></div>
            <MetricBar value={faunaLatency} max={150} color={latColor} />
          </div>
        </div>

        {/* ── Ligne 2 : Comparaison Fauna vs CouchDB ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-sm">Comparaison Fauna vs CouchDB</span>
            <span className="ml-auto text-xs text-gray-500">Mise à jour toutes les 2s</span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {/* Fauna docs */}
            <div className="bg-indigo-950/50 border border-indigo-800/50 rounded-xl p-4 text-center">
              <div className="text-xs text-indigo-300 mb-1 font-medium">🦁 Fauna — Documents</div>
              <div className="text-3xl font-black text-indigo-400">{fmt(faunaCount)}</div>
              <div className="text-xs text-gray-500 mt-1">Transactions ACID</div>
            </div>
            {/* CouchDB docs */}
            <div className="bg-orange-950/30 border border-orange-800/40 rounded-xl p-4 text-center">
              <div className="text-xs text-orange-300 mb-1 font-medium">🛋️ CouchDB — Documents</div>
              <div className="text-3xl font-black text-orange-400">{fmt(couchCount)}</div>
              <div className="text-xs text-gray-500 mt-1">Cohérence éventuelle</div>
            </div>
            {/* Fauna latence */}
            <div className="bg-indigo-950/50 border border-indigo-800/50 rounded-xl p-4 text-center">
              <div className="text-xs text-indigo-300 mb-1 font-medium">🦁 Fauna — Latence</div>
              <div className="text-3xl font-black text-indigo-400">{faunaLatency.toFixed(1)}<span className="text-lg">ms</span></div>
              <div className="text-xs text-gray-500 mt-1">P95: {p95.toFixed(0)}ms · P99: {p99.toFixed(0)}ms</div>
            </div>
            {/* CouchDB latence */}
            <div className="bg-orange-950/30 border border-orange-800/40 rounded-xl p-4 text-center">
              <div className="text-xs text-orange-300 mb-1 font-medium">🛋️ CouchDB — Latence</div>
              <div className="text-3xl font-black text-orange-400">{couchLatency.toFixed(1)}<span className="text-lg">ms</span></div>
              <div className="text-xs text-gray-500 mt-1">Sans transactions ACID</div>
            </div>
          </div>

          {/* Barre de comparaison visuelle */}
          {(faunaCount > 0 || couchCount > 0) && (
            <div className="mt-4 space-y-2">
              <div className="text-xs text-gray-400 font-medium">Répartition des documents</div>
              <div className="flex rounded-full overflow-hidden h-4">
                <div
                  className="bg-indigo-500 flex items-center justify-center text-xs font-bold transition-all duration-700"
                  style={{ width: `${faunaCount + couchCount > 0 ? (faunaCount / (faunaCount + couchCount)) * 100 : 50}%` }}
                >
                  {faunaCount + couchCount > 0 ? `Fauna ${((faunaCount / (faunaCount + couchCount)) * 100).toFixed(0)}%` : ''}
                </div>
                <div
                  className="bg-orange-500 flex items-center justify-center text-xs font-bold transition-all duration-700"
                  style={{ width: `${faunaCount + couchCount > 0 ? (couchCount / (faunaCount + couchCount)) * 100 : 50}%` }}
                >
                  {faunaCount + couchCount > 0 ? `CouchDB ${((couchCount / (faunaCount + couchCount)) * 100).toFixed(0)}%` : ''}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Ligne 3 : Graphiques ── */}
        <div className="grid grid-cols-2 gap-4">

          {/* Latence temps réel */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col" style={{ height: 280 }}>
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span className="font-semibold text-sm">Latence en Temps Réel</span>
              </div>
              <div className="flex gap-3 text-xs text-gray-400">
                <span className="text-orange-400">P95: {p95.toFixed(0)}ms</span>
                <span className="text-red-400">P99: {p99.toFixed(0)}ms</span>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              {latencyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={latencyChartData} margin={{ top: 4, right: 8, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#6b7280' }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} unit="ms" />
                    <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', fontSize: 11 }} formatter={(v: number) => [`${v}ms`]} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    {p95 > 0 && <ReferenceLine y={p95} stroke="#f97316" strokeDasharray="4 2" />}
                    {nodes.map((node, i) => (
                      <Line key={node} type="monotone" dataKey={node} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-600 text-sm">En attente de données...</div>
              )}
            </div>
          </div>

          {/* Répartition par machine */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col" style={{ height: 280 }}>
            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
              <Users className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold text-sm">Documents par Machine</span>
              <span className="ml-auto text-xs text-gray-500">{machineStats.length} nœuds</span>
            </div>
            <div className="flex-1 min-h-0">
              {machineStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={machineStats.map((s, i) => ({ name: s.node, docs: s.count, color: COLORS[i % COLORS.length] }))} margin={{ top: 4, right: 8, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', fontSize: 11 }} formatter={(v: number) => [`${v.toLocaleString()} docs`]} />
                    <Bar dataKey="docs" radius={[4, 4, 0, 0]}>
                      {machineStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-600 text-sm">En attente de données...</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Ligne 4 : Tableau des machines ── */}
        {machineStats.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold text-sm">Détail par Machine</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-2 text-xs text-gray-400 font-medium">Machine</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-400 font-medium">Région</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-400 font-medium">Documents</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-400 font-medium">CPU</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-400 font-medium">RAM</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-400 font-medium">Réseau</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-400 font-medium">Latence</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-400 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {machineStats.map((s, i) => (
                  <tr key={s.node} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="font-medium">{s.node}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-400">{REGION_FLAGS[s.region] || '🖥️'} {s.region}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-indigo-400">{s.count.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-mono ${s.avgCpu > 80 ? 'text-red-400' : s.avgCpu > 60 ? 'text-yellow-400' : 'text-green-400'}`}>{s.avgCpu.toFixed(1)}%</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-mono ${s.avgMemory > 80 ? 'text-red-400' : s.avgMemory > 60 ? 'text-yellow-400' : 'text-green-400'}`}>{s.avgMemory.toFixed(1)}%</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-orange-400">{s.avgNetwork.toFixed(0)} MB/s</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-mono font-semibold ${s.avgLatency > 100 ? 'text-red-400' : s.avgLatency > 50 ? 'text-yellow-400' : 'text-green-400'}`}>{s.avgLatency.toFixed(1)}ms</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="px-2 py-0.5 bg-green-900/40 text-green-400 border border-green-700/40 rounded-full text-xs font-medium">● Actif</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Message si aucune donnée */}
        {machineStats.length === 0 && faunaCount === 0 && (
          <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-10 text-center">
            <Globe className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <div className="text-gray-400 font-medium mb-1">En attente de données</div>
            <div className="text-gray-600 text-sm">Lancez les scripts d'injection sur les autres machines</div>
            <div className="mt-4 bg-gray-800 rounded-lg px-4 py-3 text-left inline-block">
              <code className="text-xs text-green-400">python scripts/inject_data.py --host {config.domain} --secret {config.secret.substring(0, 8)}... --node PC2 --region Europe</code>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
