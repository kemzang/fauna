import { useState, useEffect, useRef } from 'react';
import { LogOut, Database, Zap, Cpu, Wifi, Activity, Monitor, Clock, Users } from 'lucide-react';
import { getMachineStats, getTotalDocumentCount, getLatencyData, getCouchDBDocCount, getCouchDBAvgLatency, initializeCouchDB, getDockerStats } from '../services/fauna';
import type { ConnectionConfig, MachineStats, LatencyData, DockerStats } from '../types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';

const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb7185'];

interface Props { config: ConnectionConfig; onDisconnect: () => void; }

export default function Dashboard({ config, onDisconnect }: Props) {
  const [faunaCount, setFaunaCount] = useState(0);
  const [couchCount, setCouchCount] = useState(0);
  const [couchLatency, setCouchLatency] = useState(0);
  const [machines, setMachines] = useState<MachineStats[]>([]);
  const [latHistory, setLatHistory] = useState<LatencyData[]>([]);
  const [dps, setDps] = useState(0);
  const [dockerStats, setDockerStats] = useState<{ fauna: DockerStats; couchdb: DockerStats } | null>(null);
  const prevRef = useRef({ count: 0, time: Date.now() });

  useEffect(() => { initializeCouchDB(config.domain, 5984); }, [config]);

  useEffect(() => {
    const tick = async () => {
      const [fc, cc, cl, ms, ld, ds] = await Promise.all([
        getTotalDocumentCount(), getCouchDBDocCount(), getCouchDBAvgLatency(),
        getMachineStats(), getLatencyData(400), getDockerStats(),
      ]);
      const now = Date.now();
      const dt = (now - prevRef.current.time) / 1000;
      const diff = fc - prevRef.current.count;
      if (dt > 0 && diff > 0) setDps(Math.round(diff / dt));
      prevRef.current = { count: fc, time: now };
      setFaunaCount(fc); setCouchCount(cc); setCouchLatency(cl);
      setMachines(ms); setLatHistory(ld);
      if (ds) setDockerStats(ds);
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, []);

  // Métriques agrégées
  const avgCpu = machines.length ? machines.reduce((s, m) => s + m.avgCpu, 0) / machines.length : 0;
  const avgMem = machines.length ? machines.reduce((s, m) => s + m.avgMemory, 0) / machines.length : 0;
  const avgLat = latHistory.length ? latHistory.reduce((s, d) => s + d.latency, 0) / latHistory.length : 0;
  const sorted = [...latHistory].map(d => d.latency).sort((a, b) => a - b);
  const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
  const p99 = sorted.length ? sorted[Math.floor(sorted.length * 0.99)] : 0;

  // Graphique latence
  const nodes = [...new Set(latHistory.map(d => d.node))].sort();
  const buckets: Record<string, Record<string, number[]>> = {};
  latHistory.forEach(d => {
    const k = new Date(Math.floor(d.timestamp / 3000) * 3000).toLocaleTimeString('fr-FR');
    if (!buckets[k]) buckets[k] = {};
    if (!buckets[k][d.node]) buckets[k][d.node] = [];
    buckets[k][d.node].push(d.latency);
  });
  const latChart = Object.entries(buckets).slice(-30).map(([time, nm]) => {
    const pt: Record<string, number | string> = { time };
    nodes.forEach(n => { if (nm[n]) pt[n] = +(nm[n].reduce((a, b) => a + b, 0) / nm[n].length).toFixed(1); });
    return pt;
  });

  const fmt = (n: number) => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : n.toString();
  const latColor = avgLat < 50 ? '#34d399' : avgLat < 100 ? '#fbbf24' : '#f87171';
  const total = faunaCount + couchCount;
  const fPct = total > 0 ? (faunaCount / total * 100) : 50;
  const cPct = total > 0 ? (couchCount / total * 100) : 50;

  return (
    <div style={{ minHeight: '100vh', background: '#030712', color: '#f9fafb', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 36, height: 36, background: '#4f46e5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Database size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Fauna Dashboard</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{config.domain}:{config.port}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#052e16', border: '1px solid #166534', borderRadius: 20, padding: '4px 10px' }}>
            <div style={{ width: 7, height: 7, background: '#4ade80', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>LIVE</span>
          </div>
        </div>
        <button onClick={onDisconnect} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#7f1d1d', border: 'none', color: '#fca5a5', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}>
          <LogOut size={14} /> Déconnexion
        </button>
      </div>

      <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Ligne 1 : KPIs ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12 }}>

          {/* Docs Fauna — grand */}
          <div style={{ background: 'linear-gradient(135deg, #312e81, #4c1d95)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 12 }}>
              <Database size={28} color="#a5b4fc" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#a5b4fc', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Documents Fauna</div>
              <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.1, color: '#fff' }}>{fmt(faunaCount)}</div>
              <div style={{ fontSize: 12, color: '#818cf8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Zap size={12} color={dps > 0 ? '#fde047' : '#818cf8'} />
                {dps} docs/s · {machines.length} nœuds actifs
              </div>
            </div>
          </div>

          {/* CPU */}
          <KpiCard icon={<Cpu size={18} color="#60a5fa" />} label="CPU Fauna" value={`${dockerStats ? dockerStats.fauna.cpu_pct.toFixed(1) : avgCpu.toFixed(1)}%`} color="#60a5fa" pct={dockerStats ? dockerStats.fauna.cpu_pct : avgCpu} max={100} />
          {/* RAM */}
          <KpiCard icon={<Monitor size={18} color="#34d399" />} label="RAM Fauna" value={`${dockerStats ? dockerStats.fauna.mem_mb.toFixed(0) : avgMem.toFixed(0)} MB`} color="#34d399" pct={dockerStats ? dockerStats.fauna.mem_pct : avgMem} max={100} />
          {/* Réseau */}
          <KpiCard icon={<Wifi size={18} color="#fb923c" />} label="Réseau Fauna" value={`${dockerStats ? (dockerStats.fauna.net_in_mb + dockerStats.fauna.net_out_mb).toFixed(0) : '0'} MB`} color="#fb923c" pct={dockerStats ? Math.min(100, (dockerStats.fauna.net_in_mb + dockerStats.fauna.net_out_mb) / 10) : 0} max={100} />
          {/* Latence */}
          <KpiCard icon={<Activity size={18} color={latColor} />} label="Latence moy." value={`${avgLat.toFixed(1)}ms`} color={latColor} pct={avgLat} max={150} badge={avgLat < 50 ? 'Excellent' : avgLat < 100 ? 'Bon' : 'Élevé'} />
        </div>

        {/* ── Ligne 2 : Comparaison Fauna vs CouchDB ── */}
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={14} color="#818cf8" />
            COMPARAISON FAUNA vs COUCHDB
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
            <CompCard emoji="🦁" label="Fauna — Documents" value={fmt(faunaCount)} sub="Transactions ACID" color="#818cf8" bg="#1e1b4b" />
            <CompCard emoji="🛋️" label="CouchDB — Documents" value={fmt(couchCount)} sub="Cohérence éventuelle" color="#fb923c" bg="#1c1008" />
            <CompCard emoji="🦁" label="Fauna — RAM" value={`${dockerStats ? dockerStats.fauna.mem_mb.toFixed(0) : '?'} MB`} sub={`CPU: ${dockerStats ? dockerStats.fauna.cpu_pct.toFixed(1) : '?'}%`} color="#818cf8" bg="#1e1b4b" />
            <CompCard emoji="🛋️" label="CouchDB — RAM" value={`${dockerStats ? dockerStats.couchdb.mem_mb.toFixed(0) : '?'} MB`} sub={`CPU: ${dockerStats ? dockerStats.couchdb.cpu_pct.toFixed(1) : '?'}%`} color="#fb923c" bg="#1c1008" />
          </div>
          {/* Barre de répartition */}
          <div>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>Répartition des documents injectés</div>
            <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', background: '#1e293b' }}>
              <div style={{ width: `${fPct}%`, background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, transition: 'width 0.7s', minWidth: faunaCount > 0 ? 60 : 0 }}>
                {faunaCount > 0 && `Fauna ${fPct.toFixed(0)}%`}
              </div>
              <div style={{ width: `${cPct}%`, background: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, transition: 'width 0.7s', minWidth: couchCount > 0 ? 60 : 0 }}>
                {couchCount > 0 && `CouchDB ${cPct.toFixed(0)}%`}
              </div>
            </div>
          </div>
        </div>

        {/* ── Ligne 3 : Graphiques ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          {/* Latence temps réel */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 16, height: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>
                <Clock size={14} color="#818cf8" /> LATENCE EN TEMPS RÉEL
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                <span style={{ color: '#fb923c' }}>P95: {p95.toFixed(0)}ms</span>
                <span style={{ color: '#f87171' }}>P99: {p99.toFixed(0)}ms</span>
              </div>
            </div>
            <div style={{ height: 190 }}>
              {latChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={latChart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#475569' }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: '#475569' }} unit="ms" />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }} formatter={(v: number) => [`${v}ms`]} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    {nodes.map((n, i) => <Line key={n} type="monotone" dataKey={n} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} connectNulls />)}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Empty text="En attente de données..." />
              )}
            </div>
          </div>

          {/* Documents par machine */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 16, height: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 12 }}>
              <Users size={14} color="#818cf8" /> DOCUMENTS PAR MACHINE
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>{machines.length} nœuds</span>
            </div>
            <div style={{ height: 190 }}>
              {machines.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={machines.map((m, i) => ({ name: m.node, docs: m.count, fill: COLORS[i % COLORS.length] }))} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }} formatter={(v: number) => [`${v.toLocaleString()} docs`]} />
                    <Bar dataKey="docs" radius={[4, 4, 0, 0]}>
                      {machines.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty text="En attente de données..." />
              )}
            </div>
          </div>
        </div>

        {/* ── Ligne 4 : Tableau machines ── */}
        {machines.length > 0 && (
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', fontSize: 13, fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Monitor size={14} color="#818cf8" /> DÉTAIL PAR MACHINE
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e293b' }}>
                  {['Machine', 'Région', 'Documents', 'CPU', 'RAM', 'Réseau', 'Latence', 'Statut'].map(h => (
                    <th key={h} style={{ padding: '8px 16px', textAlign: h === 'Machine' || h === 'Région' ? 'left' : 'right', fontSize: 11, color: '#475569', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {machines.map((m, i) => (
                  <tr key={m.node} style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                        <span style={{ fontWeight: 600 }}>{m.node}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#64748b' }}>{m.region}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#818cf8', fontFamily: 'monospace' }}>{m.count.toLocaleString()}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: m.avgCpu > 80 ? '#f87171' : m.avgCpu > 60 ? '#fbbf24' : '#34d399', fontFamily: 'monospace' }}>{m.avgCpu.toFixed(1)}%</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: m.avgMemory > 80 ? '#f87171' : m.avgMemory > 60 ? '#fbbf24' : '#34d399', fontFamily: 'monospace' }}>{m.avgMemory.toFixed(1)}%</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#fb923c', fontFamily: 'monospace' }}>{m.avgNetwork.toFixed(0)} MB/s</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: m.avgLatency > 100 ? '#f87171' : m.avgLatency > 50 ? '#fbbf24' : '#34d399', fontFamily: 'monospace', fontWeight: 700 }}>{m.avgLatency.toFixed(1)}ms</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <span style={{ background: '#052e16', color: '#4ade80', border: '1px solid #166534', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>● Actif</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Message vide */}
        {machines.length === 0 && faunaCount === 0 && (
          <div style={{ background: '#0f172a', border: '1px dashed #1e293b', borderRadius: 12, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#475569', marginBottom: 8 }}>En attente de données</div>
            <div style={{ fontSize: 12, color: '#334155', marginBottom: 16 }}>Lancez les scripts d'injection sur les autres machines</div>
            <code style={{ background: '#1e293b', color: '#4ade80', padding: '8px 16px', borderRadius: 8, fontSize: 12 }}>
              python scripts/inject_data.py --host {config.domain} --secret {config.secret.substring(0, 10)}... --node PC2 --region Europe
            </code>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Composants utilitaires ──

function KpiCard({ icon, label, value, color, pct, max, badge }: { icon: React.ReactNode; label: string; value: string; color: string; pct: number; max: number; badge?: string }) {
  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {icon}
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{label}</span>
        {badge && <span style={{ marginLeft: 'auto', fontSize: 10, color, background: color + '20', padding: '2px 6px', borderRadius: 10, fontWeight: 600 }}>{badge}</span>}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ height: 4, background: '#1e293b', borderRadius: 4, marginTop: 8 }}>
        <div style={{ height: 4, borderRadius: 4, background: color, width: `${Math.min(100, (pct / max) * 100)}%`, transition: 'width 0.7s' }} />
      </div>
    </div>
  );
}

function CompCard({ emoji, label, value, sub, color, bg }: { emoji: string; label: string; value: string; sub: string; color: string; bg: string }) {
  return (
    <div style={{ background: bg, border: `1px solid ${color}30`, borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 11, color, fontWeight: 600, marginBottom: 6 }}>{emoji} {label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 13 }}>{text}</div>
  );
}
