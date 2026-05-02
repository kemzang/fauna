import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { Zap, Shield, Database, AlertCircle, CheckCircle, XCircle, Trophy } from 'lucide-react';
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

const FAUNA_COLOR = '#6366f1';
const COUCH_COLOR = '#f59e0b';

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
    <div className="bg-white rounded-xl p-6 shadow flex items-center justify-center h-48">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
    </div>
  );

  if (!result) return (
    <div className="bg-white rounded-xl p-6 shadow">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-indigo-600" />
        <h2 className="text-lg font-semibold text-gray-800">Benchmark : Fauna vs CouchDB</h2>
      </div>
      <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-yellow-800 font-medium text-sm mb-1">Aucun résultat de benchmark disponible</p>
          <p className="text-yellow-700 text-xs">Lancez le benchmark depuis un terminal :</p>
          <code className="block bg-yellow-100 px-2 py-1 rounded text-xs mt-1 font-mono">
            py scripts\benchmark.py --fauna-secret VOTRE_CLE --input scripts\telemetry_data.json
          </code>
        </div>
      </div>
    </div>
  );

  const faunaWinsSpeed = result.fauna.speed > result.couchdb.speed;
  const faunaWinsLatency = result.fauna.avg_latency < result.couchdb.avg_latency;
  const faunaWinsConflicts = (result.concurrent_fauna.conflicts ?? 0) <= (result.concurrent_couchdb.conflicts ?? 0);
  const faunaScore = [faunaWinsSpeed, faunaWinsLatency, faunaWinsConflicts, result.acid_fauna?.correct].filter(Boolean).length;

  const speedData = [
    { name: 'Fauna', value: result.fauna.speed, fill: FAUNA_COLOR },
    { name: 'CouchDB', value: result.couchdb.speed, fill: COUCH_COLOR },
  ];
  const latencyData = [
    { name: 'Fauna', value: result.fauna.avg_latency, fill: FAUNA_COLOR },
    { name: 'CouchDB', value: result.couchdb.avg_latency, fill: COUCH_COLOR },
  ];
  const concSpeedData = [
    { name: 'Fauna', value: result.concurrent_fauna.speed, fill: FAUNA_COLOR },
    { name: 'CouchDB', value: result.concurrent_couchdb.speed, fill: COUCH_COLOR },
  ];
  const conflictData = [
    { name: 'Fauna', value: result.concurrent_fauna.conflicts ?? 0, fill: FAUNA_COLOR },
    { name: 'CouchDB', value: result.concurrent_couchdb.conflicts ?? 0, fill: COUCH_COLOR },
  ];

  const Win = ({ ok }: { ok: boolean }) => ok
    ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
    : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;

  const MiniChart = ({ data, unit, lowerIsBetter = false }: { data: { name: string; value: number; fill: string }[]; unit: string; lowerIsBetter?: boolean }) => {
    const winner = lowerIsBetter
      ? data.reduce((a, b) => a.value < b.value ? a : b)
      : data.reduce((a, b) => a.value > b.value ? a : b);
    return (
      <div>
        <ResponsiveContainer width="100%" height={110}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 9 }} />
            <Tooltip formatter={(v: number) => [`${v.toLocaleString()} ${unit}`]} contentStyle={{ fontSize: 11 }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="text-center text-xs mt-1">
          <span className="font-semibold" style={{ color: winner.fill }}>
            {winner.name} gagne
          </span>
          {data.length === 2 && data[0].value > 0 && data[1].value > 0 && (
            <span className="text-gray-400 ml-1">
              ({lowerIsBetter
                ? `${((Math.max(...data.map(d => d.value)) / Math.min(...data.map(d => d.value)) - 1) * 100).toFixed(0)}% moins`
                : `${((Math.max(...data.map(d => d.value)) / Math.min(...data.map(d => d.value)) - 1) * 100).toFixed(0)}% plus`})
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Titre + score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-800">Benchmark : Fauna vs CouchDB</h2>
          <span className="text-xs text-gray-400">{new Date(result.timestamp).toLocaleString('fr-FR')}</span>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5">
          <Trophy className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-bold text-indigo-700">Fauna {faunaScore}/4 tests</span>
        </div>
      </div>

      {/* Scorecard */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Vitesse séquentielle', ok: faunaWinsSpeed, detail: faunaWinsSpeed ? `${result.fauna.speed.toLocaleString()} vs ${result.couchdb.speed.toLocaleString()} docs/s` : `${result.couchdb.speed.toLocaleString()} vs ${result.fauna.speed.toLocaleString()} docs/s` },
          { label: 'Latence', ok: faunaWinsLatency, detail: `${result.fauna.avg_latency}ms vs ${result.couchdb.avg_latency}ms` },
          { label: 'Conflits concurrents', ok: faunaWinsConflicts, detail: `Fauna: ${result.concurrent_fauna.conflicts ?? 0} · CouchDB: ${result.concurrent_couchdb.conflicts ?? 0}` },
          { label: 'Cohérence ACID', ok: result.acid_fauna?.correct ?? false, detail: result.acid_fauna?.correct ? 'Aucune perte de données' : 'Données perdues' },
        ].map(item => (
          <div key={item.label} className={`rounded-xl p-3 border ${item.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Win ok={item.ok} />
              <span className="text-xs font-semibold text-gray-700">{item.label}</span>
            </div>
            <div className={`text-xs ${item.ok ? 'text-green-700' : 'text-red-600'}`}>
              {item.ok ? '✅ Fauna' : '⚠️ CouchDB'} gagne
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{item.detail}</div>
          </div>
        ))}
      </div>

      {/* 4 graphiques */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-3 shadow">
          <div className="flex items-center gap-1.5 mb-2">
            <Database className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-xs font-semibold text-gray-700">Vitesse séquentielle</span>
          </div>
          <MiniChart data={speedData} unit="docs/s" />
        </div>
        <div className="bg-white rounded-xl p-3 shadow">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs font-semibold text-gray-700">Latence moyenne</span>
          </div>
          <MiniChart data={latencyData} unit="ms" lowerIsBetter />
        </div>
        <div className="bg-white rounded-xl p-3 shadow">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap className="w-3.5 h-3.5 text-green-500" />
            <span className="text-xs font-semibold text-gray-700">Vitesse concurrente</span>
          </div>
          <MiniChart data={concSpeedData} unit="docs/s" />
        </div>
        <div className="bg-white rounded-xl p-3 shadow">
          <div className="flex items-center gap-1.5 mb-2">
            <Shield className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs font-semibold text-gray-700">Conflits (concurrence)</span>
          </div>
          <MiniChart data={conflictData} unit="conflits" lowerIsBetter />
        </div>
      </div>

      {/* Tableaux détaillés */}
      <div className="grid grid-cols-2 gap-4">
        {/* Test 1 */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-gray-700">Test 1 — Injection séquentielle</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Métrique</th>
                <th className="text-center px-3 py-2 font-semibold" style={{ color: FAUNA_COLOR }}>Fauna</th>
                <th className="text-center px-3 py-2 font-semibold" style={{ color: COUCH_COLOR }}>CouchDB</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { label: 'Docs injectés', f: result.fauna.docs.toLocaleString(), c: result.couchdb.docs.toLocaleString(), fWins: result.fauna.docs >= result.couchdb.docs },
                { label: 'Temps total', f: `${result.fauna.elapsed}s`, c: `${result.couchdb.elapsed}s`, fWins: result.fauna.elapsed <= result.couchdb.elapsed },
                { label: 'Vitesse (docs/s)', f: result.fauna.speed.toLocaleString(), c: result.couchdb.speed.toLocaleString(), fWins: faunaWinsSpeed },
                { label: 'Latence moy.', f: `${result.fauna.avg_latency}ms`, c: `${result.couchdb.avg_latency}ms`, fWins: faunaWinsLatency },
                { label: 'Latence max.', f: `${result.fauna.max_latency ?? '—'}ms`, c: `${result.couchdb.max_latency ?? '—'}ms`, fWins: (result.fauna.max_latency ?? 0) <= (result.couchdb.max_latency ?? 0) },
                { label: 'Erreurs', f: String(result.fauna.errors), c: String(result.couchdb.errors), fWins: result.fauna.errors <= result.couchdb.errors },
              ].map(row => (
                <tr key={row.label} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-600">{row.label}</td>
                  <td className={`px-3 py-2 text-center font-semibold ${row.fWins ? 'text-green-600' : 'text-red-500'}`}>{row.f}</td>
                  <td className={`px-3 py-2 text-center font-semibold ${!row.fWins ? 'text-green-600' : 'text-red-500'}`}>{row.c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Test 2 */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-500" />
            <span className="text-sm font-semibold text-gray-700">Test 2 — Concurrence 4 threads (ACID)</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Métrique</th>
                <th className="text-center px-3 py-2 font-semibold" style={{ color: FAUNA_COLOR }}>Fauna</th>
                <th className="text-center px-3 py-2 font-semibold" style={{ color: COUCH_COLOR }}>CouchDB</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { label: 'Docs injectés', f: result.concurrent_fauna.docs.toLocaleString(), c: result.concurrent_couchdb.docs.toLocaleString(), fWins: result.concurrent_fauna.docs >= result.concurrent_couchdb.docs },
                { label: 'Temps total', f: `${result.concurrent_fauna.elapsed}s`, c: `${result.concurrent_couchdb.elapsed}s`, fWins: result.concurrent_fauna.elapsed <= result.concurrent_couchdb.elapsed },
                { label: 'Vitesse (docs/s)', f: result.concurrent_fauna.speed.toLocaleString(), c: result.concurrent_couchdb.speed.toLocaleString(), fWins: result.concurrent_fauna.speed >= result.concurrent_couchdb.speed },
                { label: 'Latence moy.', f: `${result.concurrent_fauna.avg_latency}ms`, c: `${result.concurrent_couchdb.avg_latency}ms`, fWins: result.concurrent_fauna.avg_latency <= result.concurrent_couchdb.avg_latency },
                { label: '⚠️ Conflits', f: String(result.concurrent_fauna.conflicts ?? 0), c: String(result.concurrent_couchdb.conflicts ?? 0), fWins: faunaWinsConflicts },
                { label: 'Erreurs', f: String(result.concurrent_fauna.errors), c: String(result.concurrent_couchdb.errors), fWins: result.concurrent_fauna.errors <= result.concurrent_couchdb.errors },
              ].map(row => (
                <tr key={row.label} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-600 font-medium">{row.label}</td>
                  <td className={`px-3 py-2 text-center font-bold ${row.fWins ? 'text-green-600' : 'text-red-500'}`}>{row.f}</td>
                  <td className={`px-3 py-2 text-center font-bold ${!row.fWins ? 'text-green-600' : 'text-red-500'}`}>{row.c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Test 3 ACID */}
      {result.acid_fauna && result.acid_couchdb && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-semibold text-gray-700">
              Test 3 — Cohérence ACID : {result.acid_fauna.expected} incréments concurrents sur le même document
            </span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            {[
              { label: 'Fauna', color: FAUNA_COLOR, data: result.acid_fauna, bg: result.acid_fauna.correct ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300' },
              { label: 'CouchDB', color: COUCH_COLOR, data: result.acid_couchdb, bg: result.acid_couchdb.correct ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300' },
            ].map(item => (
              <div key={item.label} className={`rounded-xl p-4 border-2 ${item.bg}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-sm" style={{ color: item.color }}>{item.label}</span>
                  {item.data.correct
                    ? <span className="flex items-center gap-1 text-green-700 text-xs font-semibold"><CheckCircle className="w-4 h-4" /> ACID respecté</span>
                    : <span className="flex items-center gap-1 text-red-600 text-xs font-semibold"><XCircle className="w-4 h-4" /> Données perdues</span>
                  }
                </div>
                <div className="flex items-end gap-3">
                  <div>
                    <div className="text-4xl font-black text-gray-800">{item.data.actual}</div>
                    <div className="text-xs text-gray-500">valeur finale</div>
                  </div>
                  <div className="text-sm text-gray-400 mb-1">/ {item.data.expected} attendu</div>
                </div>
                {!item.data.correct && (
                  <div className="mt-2 text-sm font-semibold text-red-600">
                    {item.data.expected - item.data.actual} mises à jour perdues
                  </div>
                )}
                <div className="mt-2 text-xs text-gray-500">Conflits détectés : {item.data.conflicts}</div>
              </div>
            ))}
          </div>
          <div className="px-4 pb-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs text-indigo-700">
              <strong>Pourquoi c'est important :</strong> Dans un système distribué, plusieurs nœuds peuvent modifier le même document simultanément.
              Fauna garantit l'atomicité via ses transactions ACID — chaque incrément est appliqué sans perte.
              CouchDB utilise un système de révisions optimiste : sous forte concurrence, les conflits causent des pertes silencieuses.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
