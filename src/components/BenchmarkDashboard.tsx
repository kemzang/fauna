import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, RadarChart, PolarGrid,
  PolarAngleAxis, Radar, Legend,
} from 'recharts';
import { Zap, Shield, Database, AlertCircle, CheckCircle, XCircle, Trophy, Clock, TrendingUp } from 'lucide-react';
import { fqlQuery } from '../services/fauna';

interface TestResult {
  docs: number; errors: number; elapsed: number;
  speed: number; avg_latency: number; max_latency?: number; conflicts?: number;
}
interface AcidResult {
  expected: number; actual: number; correct: boolean; errors: number; conflicts: number;
}
interface BenchmarkResult {
  timestamp: number;
  fauna: TestResult; couchdb: TestResult;
  concurrent_fauna: TestResult; concurrent_couchdb: TestResult;
  acid_fauna: AcidResult; acid_couchdb: AcidResult;
}

const F = '#6366f1';
const C = '#f59e0b';

const MetricCard = ({ label, fVal, cVal, unit, lowerIsBetter = false, icon: Icon }:
  { label: string; fVal: number; cVal: number; unit: string; lowerIsBetter?: boolean; icon: React.ElementType }) => {
  const fWins = lowerIsBetter ? fVal <= cVal : fVal >= cVal;
  const diff = fVal > 0 && cVal > 0
    ? Math.abs(((Math.max(fVal, cVal) / Math.min(fVal, cVal)) - 1) * 100).toFixed(0)
    : null;
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex-1">
          <div className="text-xs text-indigo-400 mb-1 font-medium">Fauna</div>
          <div className={`text-2xl font-black ${fWins ? 'text-green-400' : 'text-red-400'}`}>
            {typeof fVal === 'number' && fVal % 1 !== 0 ? fVal.toFixed(1) : fVal.toLocaleString()}
            <span className="text-sm font-normal text-slate-500 ml-1">{unit}</span>
          </div>
        </div>
        <div className="flex flex-col items-center px-2">
          {diff && <span className="text-xs text-slate-500">{diff}%</span>}
          <span className="text-slate-600 text-lg">vs</span>
        </div>
        <div className="flex-1 text-right">
          <div className="text-xs text-amber-400 mb-1 font-medium">CouchDB</div>
          <div className={`text-2xl font-black ${!fWins ? 'text-green-400' : 'text-red-400'}`}>
            {typeof cVal === 'number' && cVal % 1 !== 0 ? cVal.toFixed(1) : cVal.toLocaleString()}
            <span className="text-sm font-normal text-slate-500 ml-1">{unit}</span>
          </div>
        </div>
      </div>
      <div className={`mt-3 text-xs font-semibold px-2 py-1 rounded-full text-center ${fWins ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
        {fWins ? '✅ Fauna gagne' : '⚠️ CouchDB gagne'}
        {diff && ` · ${diff}% d'écart`}
      </div>
    </div>
  );
};

export default function BenchmarkDashboard() {
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fqlQuery('BenchmarkResults.all().paginate(100)');
        const docs = res?.data?.data || [];
        if (docs.length > 0) {
          const raw = docs[docs.length - 1];
          const doc = raw?.fauna ? raw : raw?.data;
          if (doc?.fauna && doc?.couchdb) setResult(doc as BenchmarkResult);
        }
      } catch { /* pas encore de données */ }
      finally { setLoading(false); }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500" />
    </div>
  );

  if (!result) return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-indigo-400" />
        <h2 className="text-lg font-bold text-white">Benchmark : Fauna vs CouchDB</h2>
      </div>
      <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-amber-300 font-semibold text-sm mb-1">Aucun résultat disponible</p>
          <p className="text-amber-400/70 text-xs mb-2">Lancez le benchmark depuis un terminal :</p>
          <code className="block bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg text-xs text-green-400 font-mono">
            py scripts\benchmark.py --fauna-secret VOTRE_CLE --input scripts\telemetry_data.json
          </code>
        </div>
      </div>
    </div>
  );

  const fWinsSpeed = result.fauna.speed > result.couchdb.speed;
  const fWinsLatency = result.fauna.avg_latency < result.couchdb.avg_latency;
  const fWinsConflicts = (result.concurrent_fauna.conflicts ?? 0) <= (result.concurrent_couchdb.conflicts ?? 0);
  const fWinsAcid = result.acid_fauna?.correct ?? false;
  const score = [fWinsSpeed, fWinsLatency, fWinsConflicts, fWinsAcid].filter(Boolean).length;

  // Données pour le radar
  const radarData = [
    { metric: 'Vitesse', fauna: Math.min(100, (result.fauna.speed / Math.max(result.fauna.speed, result.couchdb.speed)) * 100), couchdb: Math.min(100, (result.couchdb.speed / Math.max(result.fauna.speed, result.couchdb.speed)) * 100) },
    { metric: 'Latence', fauna: Math.min(100, (1 - result.fauna.avg_latency / Math.max(result.fauna.avg_latency, result.couchdb.avg_latency)) * 100 + 20), couchdb: Math.min(100, (1 - result.couchdb.avg_latency / Math.max(result.fauna.avg_latency, result.couchdb.avg_latency)) * 100 + 20) },
    { metric: 'ACID', fauna: fWinsAcid ? 100 : 30, couchdb: result.acid_couchdb?.correct ? 100 : 20 },
    { metric: 'Concurrence', fauna: fWinsConflicts ? 95 : 40, couchdb: fWinsConflicts ? 40 : 90 },
    { metric: 'Fiabilité', fauna: 100 - (result.fauna.errors / Math.max(1, result.fauna.docs)) * 100, couchdb: 100 - (result.couchdb.errors / Math.max(1, result.couchdb.docs)) * 100 },
  ];

  return (
    <div className="space-y-4">

      {/* Header + Score */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Benchmark : Fauna vs CouchDB</h2>
          </div>
          <p className="text-xs text-slate-500">{new Date(result.timestamp).toLocaleString('fr-FR')} · 3 tests de performance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-3xl font-black text-indigo-400">{score}<span className="text-slate-500 text-lg">/4</span></div>
            <div className="text-xs text-slate-500">tests Fauna</div>
          </div>
          <div className="w-px h-10 bg-slate-700" />
          <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-4 py-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="text-sm font-bold text-white">{score >= 3 ? 'Fauna recommandé' : 'Résultats mitigés'}</span>
          </div>
        </div>
      </div>

      {/* Scorecard 4 critères */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Vitesse injection', ok: fWinsSpeed, detail: `${result.fauna.speed.toLocaleString()} vs ${result.couchdb.speed.toLocaleString()} docs/s`, icon: TrendingUp },
          { label: 'Latence réponse', ok: fWinsLatency, detail: `${result.fauna.avg_latency}ms vs ${result.couchdb.avg_latency}ms`, icon: Clock },
          { label: 'Conflits ACID', ok: fWinsConflicts, detail: `Fauna: ${result.concurrent_fauna.conflicts ?? 0} · CouchDB: ${result.concurrent_couchdb.conflicts ?? 0}`, icon: Shield },
          { label: 'Cohérence données', ok: fWinsAcid, detail: fWinsAcid ? 'Aucune perte de données' : 'Données perdues', icon: Database },
        ].map(item => (
          <div key={item.label} className={`rounded-xl p-3 border ${item.ok ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <div className="flex items-center gap-2 mb-2">
              {item.ok ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
              <span className="text-xs font-semibold text-slate-300">{item.label}</span>
            </div>
            <div className={`text-sm font-bold ${item.ok ? 'text-green-400' : 'text-red-400'}`}>
              {item.ok ? 'Fauna gagne' : 'CouchDB gagne'}
            </div>
            <div className="text-xs text-slate-500 mt-1">{item.detail}</div>
          </div>
        ))}
      </div>

      {/* Métriques détaillées + Radar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 grid grid-cols-2 gap-3">
          <MetricCard label="Vitesse séquentielle" fVal={result.fauna.speed} cVal={result.couchdb.speed} unit="docs/s" icon={TrendingUp} />
          <MetricCard label="Latence moyenne" fVal={result.fauna.avg_latency} cVal={result.couchdb.avg_latency} unit="ms" lowerIsBetter icon={Clock} />
          <MetricCard label="Vitesse concurrente" fVal={result.concurrent_fauna.speed} cVal={result.concurrent_couchdb.speed} unit="docs/s" icon={Zap} />
          <MetricCard label="Conflits détectés" fVal={result.concurrent_fauna.conflicts ?? 0} cVal={result.concurrent_couchdb.conflicts ?? 0} unit="conflits" lowerIsBetter icon={Shield} />
        </div>

        {/* Radar */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Profil global (normalisé)</div>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Radar name="Fauna" dataKey="fauna" stroke={F} fill={F} fillOpacity={0.25} strokeWidth={2} />
              <Radar name="CouchDB" dataKey="couchdb" stroke={C} fill={C} fillOpacity={0.15} strokeWidth={2} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 11 }} formatter={(v: number) => [`${v.toFixed(0)}%`]} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Graphiques barres côte à côte */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { title: 'Vitesse séquentielle (docs/s)', data: [{ name: 'Fauna', v: result.fauna.speed }, { name: 'CouchDB', v: result.couchdb.speed }], unit: 'docs/s', lowerIsBetter: false },
          { title: 'Latence moyenne (ms)', data: [{ name: 'Fauna', v: result.fauna.avg_latency }, { name: 'CouchDB', v: result.couchdb.avg_latency }], unit: 'ms', lowerIsBetter: true },
          { title: 'Conflits sous concurrence', data: [{ name: 'Fauna', v: result.concurrent_fauna.conflicts ?? 0 }, { name: 'CouchDB', v: result.concurrent_couchdb.conflicts ?? 0 }], unit: 'conflits', lowerIsBetter: true },
        ].map(chart => {
          const winner = chart.lowerIsBetter
            ? chart.data.reduce((a, b) => a.v < b.v ? a : b)
            : chart.data.reduce((a, b) => a.v > b.v ? a : b);
          return (
            <div key={chart.title} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-400 mb-3">{chart.title}</div>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={chart.data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 11 }} formatter={(v: number) => [`${v.toLocaleString()} ${chart.unit}`]} />
                  <Bar dataKey="v" radius={[4, 4, 0, 0]}>
                    {chart.data.map((entry, i) => (
                      <Cell key={i} fill={entry.name === 'Fauna' ? F : C}
                        opacity={entry.name === winner.name ? 1 : 0.5} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="text-center text-xs mt-2 font-semibold" style={{ color: winner.name === 'Fauna' ? F : C }}>
                🏆 {winner.name} gagne
              </div>
            </div>
          );
        })}
      </div>

      {/* Test ACID */}
      {result.acid_fauna && result.acid_couchdb && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-bold text-white">Test 3 — Cohérence ACID</span>
            <span className="text-xs text-slate-500 ml-2">
              {result.acid_fauna.expected} incréments concurrents sur le même document (4 threads × {result.acid_fauna.expected / 4})
            </span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            {[
              { label: 'Fauna', color: F, data: result.acid_fauna, bg: result.acid_fauna.correct ? 'border-green-500/40 bg-green-500/5' : 'border-red-500/40 bg-red-500/5' },
              { label: 'CouchDB', color: C, data: result.acid_couchdb, bg: result.acid_couchdb.correct ? 'border-green-500/40 bg-green-500/5' : 'border-red-500/40 bg-red-500/5' },
            ].map(item => (
              <div key={item.label} className={`rounded-xl p-4 border-2 ${item.bg}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-sm" style={{ color: item.color }}>{item.label}</span>
                  {item.data.correct
                    ? <span className="flex items-center gap-1 text-green-400 text-xs font-bold"><CheckCircle className="w-4 h-4" /> ACID respecté</span>
                    : <span className="flex items-center gap-1 text-red-400 text-xs font-bold"><XCircle className="w-4 h-4" /> Données perdues</span>
                  }
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-4xl font-black text-white">{item.data.actual}</span>
                  <span className="text-slate-500 text-sm">/ {item.data.expected} attendu</span>
                </div>
                {/* Barre de progression */}
                <div className="w-full bg-slate-700 rounded-full h-2 mt-2">
                  <div className={`h-2 rounded-full transition-all ${item.data.correct ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${(item.data.actual / item.data.expected) * 100}%` }} />
                </div>
                {!item.data.correct && (
                  <div className="mt-2 text-sm font-bold text-red-400">
                    ❌ {item.data.expected - item.data.actual} mises à jour perdues
                  </div>
                )}
                <div className="mt-2 text-xs text-slate-500">Conflits : {item.data.conflicts} · Erreurs : {item.data.errors}</div>
              </div>
            ))}
          </div>
          <div className="px-4 pb-4">
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 text-xs text-indigo-300">
              <strong className="text-indigo-200">Pourquoi c'est critique :</strong> Dans un système distribué, plusieurs nœuds modifient les mêmes données simultanément.
              Fauna garantit l'atomicité via ACID — chaque opération est appliquée sans perte.
              CouchDB utilise des révisions optimistes : sous concurrence, les conflits causent des pertes silencieuses de données.
            </div>
          </div>
        </div>
      )}

      {/* Tableau récapitulatif */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/50">
          <span className="text-sm font-bold text-white">Tableau comparatif complet</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Métrique</th>
                <th className="text-center px-4 py-2.5 font-bold" style={{ color: F }}>Fauna</th>
                <th className="text-center px-4 py-2.5 font-bold" style={{ color: C }}>CouchDB</th>
                <th className="text-center px-4 py-2.5 text-slate-400 font-medium">Gagnant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {[
                { label: 'Docs injectés (séq.)', f: result.fauna.docs.toLocaleString(), c: result.couchdb.docs.toLocaleString(), fWins: result.fauna.docs >= result.couchdb.docs },
                { label: 'Vitesse séquentielle', f: `${result.fauna.speed.toLocaleString()} docs/s`, c: `${result.couchdb.speed.toLocaleString()} docs/s`, fWins: fWinsSpeed },
                { label: 'Latence moyenne', f: `${result.fauna.avg_latency} ms`, c: `${result.couchdb.avg_latency} ms`, fWins: fWinsLatency },
                { label: 'Latence max', f: `${result.fauna.max_latency ?? '—'} ms`, c: `${result.couchdb.max_latency ?? '—'} ms`, fWins: (result.fauna.max_latency ?? 0) <= (result.couchdb.max_latency ?? 0) },
                { label: 'Vitesse concurrente', f: `${result.concurrent_fauna.speed.toLocaleString()} docs/s`, c: `${result.concurrent_couchdb.speed.toLocaleString()} docs/s`, fWins: result.concurrent_fauna.speed >= result.concurrent_couchdb.speed },
                { label: 'Conflits (4 threads)', f: String(result.concurrent_fauna.conflicts ?? 0), c: String(result.concurrent_couchdb.conflicts ?? 0), fWins: fWinsConflicts },
                { label: 'Cohérence ACID', f: result.acid_fauna?.correct ? '✅ Exact' : '❌ Pertes', c: result.acid_couchdb?.correct ? '✅ Exact' : '❌ Pertes', fWins: fWinsAcid },
                { label: 'Erreurs totales', f: String(result.fauna.errors + result.concurrent_fauna.errors), c: String(result.couchdb.errors + result.concurrent_couchdb.errors), fWins: (result.fauna.errors + result.concurrent_fauna.errors) <= (result.couchdb.errors + result.concurrent_couchdb.errors) },
              ].map(row => (
                <tr key={row.label} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 py-2.5 text-slate-300 font-medium">{row.label}</td>
                  <td className={`px-4 py-2.5 text-center font-bold ${row.fWins ? 'text-green-400' : 'text-red-400'}`}>{row.f}</td>
                  <td className={`px-4 py-2.5 text-center font-bold ${!row.fWins ? 'text-green-400' : 'text-red-400'}`}>{row.c}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${row.fWins ? 'bg-indigo-500/20 text-indigo-300' : 'bg-amber-500/20 text-amber-300'}`}>
                      {row.fWins ? 'Fauna' : 'CouchDB'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
