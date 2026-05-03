import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import { Zap, Shield, Database, AlertCircle, CheckCircle, XCircle, Trophy } from 'lucide-react';
import { fqlQuery } from '../services/fauna';

interface TestResult { docs: number; errors: number; elapsed: number; speed: number; avg_latency: number; max_latency?: number; conflicts?: number; }
interface AcidResult { expected: number; actual: number; correct: boolean; errors: number; conflicts: number; }
interface BenchmarkResult { timestamp: number; fauna: TestResult; couchdb: TestResult; concurrent_fauna: TestResult; concurrent_couchdb: TestResult; acid_fauna: AcidResult; acid_couchdb: AcidResult; }

const FAUNA = '#6366f1';
const COUCH = '#f59e0b';
const darkTooltip = { contentStyle: { background: '#1e2130', border: '1px solid #334155', borderRadius: 8, fontSize: 11, color: '#e2e8f0' } };

function MiniBar({ data, unit, lowerIsBetter = false }: { data: { name: string; value: number; fill: string }[]; unit: string; lowerIsBetter?: boolean }) {
  const winner = lowerIsBetter ? data.reduce((a, b) => a.value < b.value ? a : b) : data.reduce((a, b) => a.value > b.value ? a : b);
  const pct = data.length === 2 && data[0].value > 0 && data[1].value > 0
    ? ((Math.max(...data.map(d => d.value)) / Math.min(...data.map(d => d.value)) - 1) * 100).toFixed(0) : null;
  return (
    <div>
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
          <Tooltip {...darkTooltip} formatter={(v: number) => [`${v.toLocaleString()} ${unit}`]} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((e, i) => <Cell key={i} fill={e.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-center text-xs mt-1">
        <span className="font-semibold" style={{ color: winner.fill }}>{winner.name} gagne</span>
        {pct && <span className="text-slate-500 ml-1">({lowerIsBetter ? `${pct}% moins` : `${pct}% plus`})</span>}
      </p>
    </div>
  );
}

export default function BenchmarkDashboard() {
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fqlQuery('BenchmarkResults.all().paginate(100)');
        const docs = res?.data?.data || [];
        if (docs.length > 0) { const raw = docs[docs.length - 1]; const doc = raw?.fauna ? raw : raw?.data; if (doc?.fauna && doc?.couchdb) setResult(doc as BenchmarkResult); }
      } catch { /* pas encore */ } finally { setLoading(false); }
    };
    run(); const t = setInterval(run, 5000); return () => clearInterval(t);
  }, []);

  if (loading) return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" /></div>;

  if (!result) return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-indigo-400" />
        <h2 className="text-lg font-semibold text-white">Benchmark : Fauna vs CouchDB</h2>
      </div>
      <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
        <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-yellow-300 font-medium text-sm mb-1">Aucun résultat disponible</p>
          <p className="text-slate-400 text-xs mb-2">Lancez le benchmark depuis un terminal :</p>
          <code className="block bg-slate-900 px-3 py-2 rounded-lg text-xs font-mono text-emerald-400">
            py scripts\benchmark.py --fauna-secret VOTRE_CLE --input scripts\telemetry_data.json
          </code>
        </div>
      </div>
    </div>
  );

  const fWinSpeed = result.fauna.speed > result.couchdb.speed;
  const fWinLat = result.fauna.avg_latency < result.couchdb.avg_latency;
  const fWinConf = (result.concurrent_fauna.conflicts ?? 0) <= (result.concurrent_couchdb.conflicts ?? 0);
  const fWinAcid = result.acid_fauna?.correct ?? false;
  const score = [fWinSpeed, fWinLat, fWinConf, fWinAcid].filter(Boolean).length;

  const radarData = [
    { metric: 'Vitesse', Fauna: Math.min(100, (result.fauna.speed / Math.max(result.fauna.speed, result.couchdb.speed)) * 100), CouchDB: Math.min(100, (result.couchdb.speed / Math.max(result.fauna.speed, result.couchdb.speed)) * 100) },
    { metric: 'Latence', Fauna: Math.min(100, (1 - result.fauna.avg_latency / Math.max(result.fauna.avg_latency, result.couchdb.avg_latency)) * 100 + 20), CouchDB: Math.min(100, (1 - result.couchdb.avg_latency / Math.max(result.fauna.avg_latency, result.couchdb.avg_latency)) * 100 + 20) },
    { metric: 'ACID', Fauna: fWinAcid ? 100 : 30, CouchDB: result.acid_couchdb?.correct ? 100 : 30 },
    { metric: 'Conflits', Fauna: fWinConf ? 95 : 40, CouchDB: fWinConf ? 40 : 95 },
    { metric: 'Concurrence', Fauna: Math.min(100, (result.concurrent_fauna.speed / Math.max(result.concurrent_fauna.speed, result.concurrent_couchdb.speed)) * 100), CouchDB: Math.min(100, (result.concurrent_couchdb.speed / Math.max(result.concurrent_fauna.speed, result.concurrent_couchdb.speed)) * 100) },
  ];

  const scoreCards = [
    { label: 'Vitesse séquentielle', ok: fWinSpeed, detail: `${result.fauna.speed.toLocaleString()} vs ${result.couchdb.speed.toLocaleString()} docs/s` },
    { label: 'Latence', ok: fWinLat, detail: `${result.fauna.avg_latency}ms vs ${result.couchdb.avg_latency}ms` },
    { label: 'Conflits concurrents', ok: fWinConf, detail: `Fauna: ${result.concurrent_fauna.conflicts ?? 0} · CouchDB: ${result.concurrent_couchdb.conflicts ?? 0}` },
    { label: 'Cohérence ACID', ok: fWinAcid, detail: fWinAcid ? 'Aucune perte de données' : 'Données perdues' },
  ];

  const tableRows1 = [
    { label: 'Docs injectés', f: result.fauna.docs.toLocaleString(), c: result.couchdb.docs.toLocaleString(), ok: result.fauna.docs >= result.couchdb.docs },
    { label: 'Temps (s)', f: `${result.fauna.elapsed}s`, c: `${result.couchdb.elapsed}s`, ok: result.fauna.elapsed <= result.couchdb.elapsed },
    { label: 'Vitesse (docs/s)', f: result.fauna.speed.toLocaleString(), c: result.couchdb.speed.toLocaleString(), ok: fWinSpeed },
    { label: 'Latence moy.', f: `${result.fauna.avg_latency}ms`, c: `${result.couchdb.avg_latency}ms`, ok: fWinLat },
    { label: 'Erreurs', f: String(result.fauna.errors), c: String(result.couchdb.errors), ok: result.fauna.errors <= result.couchdb.errors },
  ];
  const tableRows2 = [
    { label: 'Docs injectés', f: result.concurrent_fauna.docs.toLocaleString(), c: result.concurrent_couchdb.docs.toLocaleString(), ok: result.concurrent_fauna.docs >= result.concurrent_couchdb.docs },
    { label: 'Vitesse (docs/s)', f: result.concurrent_fauna.speed.toLocaleString(), c: result.concurrent_couchdb.speed.toLocaleString(), ok: result.concurrent_fauna.speed >= result.concurrent_couchdb.speed },
    { label: 'Latence moy.', f: `${result.concurrent_fauna.avg_latency}ms`, c: `${result.concurrent_couchdb.avg_latency}ms`, ok: result.concurrent_fauna.avg_latency <= result.concurrent_couchdb.avg_latency },
    { label: '⚠️ Conflits', f: String(result.concurrent_fauna.conflicts ?? 0), c: String(result.concurrent_couchdb.conflicts ?? 0), ok: fWinConf },
    { label: 'Erreurs', f: String(result.concurrent_fauna.errors), c: String(result.concurrent_couchdb.errors), ok: result.concurrent_fauna.errors <= result.concurrent_couchdb.errors },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-white">Benchmark : Fauna vs CouchDB</h2>
          <span className="text-xs text-slate-500">{new Date(result.timestamp).toLocaleString('fr-FR')}</span>
        </div>
        <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-3 py-1.5">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-bold text-indigo-300">Fauna {score}/4 tests</span>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-4 gap-3">
        {scoreCards.map(s => (
          <div key={s.label} className={`rounded-xl p-3 border ${s.ok ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              {s.ok ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
              <span className="text-xs font-semibold text-slate-300">{s.label}</span>
            </div>
            <p className={`text-xs font-bold ${s.ok ? 'text-emerald-400' : 'text-red-400'}`}>{s.ok ? '✅ Fauna gagne' : '⚠️ CouchDB gagne'}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.detail}</p>
          </div>
        ))}
      </div>

      {/* Radar + 4 mini charts */}
      <div className="grid grid-cols-3 gap-4">
        {/* Radar */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
          <p className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-indigo-400" />Vue d'ensemble</p>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#1e293b" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Radar name="Fauna" dataKey="Fauna" stroke={FAUNA} fill={FAUNA} fillOpacity={0.25} />
              <Radar name="CouchDB" dataKey="CouchDB" stroke={COUCH} fill={COUCH} fillOpacity={0.15} />
              <Tooltip {...darkTooltip} formatter={(v: number) => [`${v.toFixed(0)}%`]} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-1">
            <span className="flex items-center gap-1 text-xs" style={{ color: FAUNA }}><span className="w-2 h-2 rounded-full inline-block" style={{ background: FAUNA }} />Fauna</span>
            <span className="flex items-center gap-1 text-xs" style={{ color: COUCH }}><span className="w-2 h-2 rounded-full inline-block" style={{ background: COUCH }} />CouchDB</span>
          </div>
        </div>

        {/* 4 mini charts en 2x2 */}
        <div className="col-span-2 grid grid-cols-2 gap-3">
          {[
            { title: 'Vitesse séquentielle', data: [{ name: 'Fauna', value: result.fauna.speed, fill: FAUNA }, { name: 'CouchDB', value: result.couchdb.speed, fill: COUCH }], unit: 'docs/s', icon: Database },
            { title: 'Latence moyenne', data: [{ name: 'Fauna', value: result.fauna.avg_latency, fill: FAUNA }, { name: 'CouchDB', value: result.couchdb.avg_latency, fill: COUCH }], unit: 'ms', icon: Zap, lower: true },
            { title: 'Vitesse concurrente', data: [{ name: 'Fauna', value: result.concurrent_fauna.speed, fill: FAUNA }, { name: 'CouchDB', value: result.concurrent_couchdb.speed, fill: COUCH }], unit: 'docs/s', icon: Zap },
            { title: 'Conflits (4 threads)', data: [{ name: 'Fauna', value: result.concurrent_fauna.conflicts ?? 0, fill: FAUNA }, { name: 'CouchDB', value: result.concurrent_couchdb.conflicts ?? 0, fill: COUCH }], unit: 'conflits', icon: Shield, lower: true },
          ].map(c => (
            <div key={c.title} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <c.icon className="w-3.5 h-3.5 text-indigo-400" />{c.title}
              </p>
              <MiniBar data={c.data} unit={c.unit} lowerIsBetter={c.lower} />
            </div>
          ))}
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { title: 'Test 1 — Injection séquentielle', icon: Database, rows: tableRows1 },
          { title: 'Test 2 — Concurrence 4 threads', icon: Shield, rows: tableRows2 },
        ].map(tbl => (
          <div key={tbl.title} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-700/50 flex items-center gap-2">
              <tbl.icon className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-semibold text-white">{tbl.title}</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/30">
                  <th className="text-left px-4 py-2 text-slate-400 font-medium">Métrique</th>
                  <th className="text-center px-3 py-2 font-semibold" style={{ color: FAUNA }}>Fauna</th>
                  <th className="text-center px-3 py-2 font-semibold" style={{ color: COUCH }}>CouchDB</th>
                </tr>
              </thead>
              <tbody>
                {tbl.rows.map(r => (
                  <tr key={r.label} className="border-b border-slate-700/20 hover:bg-white/5">
                    <td className="px-4 py-2 text-slate-400">{r.label}</td>
                    <td className={`px-3 py-2 text-center font-bold ${r.ok ? 'text-emerald-400' : 'text-red-400'}`}>{r.f}</td>
                    <td className={`px-3 py-2 text-center font-bold ${!r.ok ? 'text-emerald-400' : 'text-red-400'}`}>{r.c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* ACID test */}
      {result.acid_fauna && result.acid_couchdb && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-700/50 flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-white">Test 3 — Cohérence ACID : {result.acid_fauna.expected} incréments concurrents</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            {[
              { label: 'Fauna', color: FAUNA, data: result.acid_fauna },
              { label: 'CouchDB', color: COUCH, data: result.acid_couchdb },
            ].map(item => (
              <div key={item.label} className={`rounded-xl p-4 border-2 ${item.data.correct ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-red-500/10 border-red-500/40'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-sm" style={{ color: item.color }}>{item.label}</span>
                  {item.data.correct
                    ? <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold"><CheckCircle className="w-4 h-4" />ACID respecté</span>
                    : <span className="flex items-center gap-1 text-red-400 text-xs font-semibold"><XCircle className="w-4 h-4" />Données perdues</span>}
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-black text-white">{item.data.actual}</span>
                  <span className="text-slate-500 text-sm mb-1">/ {item.data.expected} attendu</span>
                </div>
                {!item.data.correct && <p className="mt-1 text-sm font-semibold text-red-400">{item.data.expected - item.data.actual} mises à jour perdues</p>}
                <p className="mt-1 text-xs text-slate-500">Conflits : {item.data.conflicts}</p>
              </div>
            ))}
          </div>
          <div className="px-4 pb-4">
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 text-xs text-indigo-300">
              <strong>Pourquoi c'est important :</strong> Fauna garantit l'atomicité via ses transactions ACID — chaque incrément est appliqué sans perte même sous forte concurrence. CouchDB utilise des révisions optimistes : les conflits causent des pertes silencieuses de données.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
