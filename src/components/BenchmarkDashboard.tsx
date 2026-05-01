import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Zap, Clock, Database, AlertCircle, Shield } from 'lucide-react';
import { fqlQuery } from '../services/fauna';

interface TestResult {
  docs: number;
  errors: number;
  elapsed: number;
  speed: number;
  avg_latency: number;
  max_latency?: number;
  conflicts?: number;
}

interface AcidResult {
  expected: number;
  actual: number;
  correct: boolean;
  errors: number;
  conflicts: number;
}

interface BenchmarkResult {
  timestamp: number;
  fauna: TestResult;
  couchdb: TestResult;
  concurrent_fauna: TestResult;
  concurrent_couchdb: TestResult;
  acid_fauna: AcidResult;
  acid_couchdb: AcidResult;
}

export default function BenchmarkDashboard() {
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLatest = async () => {
    try {
      const res = await fqlQuery('BenchmarkResults.all().paginate(100)');
      const docs = res?.data?.data || [];
      if (docs.length > 0) {
        const raw = docs[docs.length - 1];
        const doc = raw?.fauna ? raw : raw?.data;
        if (doc?.fauna && doc?.couchdb) {
          setResult(doc as BenchmarkResult);
        }
      }
    } catch (e) {
      // pas encore de données
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatest();
    const interval = setInterval(fetchLatest, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-white rounded-xl p-6 shadow">
        <div className="flex items-center space-x-3 mb-4">
          <Zap className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-800">Benchmark : Fauna vs CouchDB</h2>
        </div>
        <div className="flex items-center space-x-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <p className="text-yellow-700 text-sm">
            Lancez le benchmark pour voir les résultats :<br />
            <code className="bg-yellow-100 px-1 rounded text-xs">
              py scripts\benchmark.py --fauna-secret VOTRE_CLE --input scripts\telemetry_data.json
            </code>
          </p>
        </div>
      </div>
    );
  }

  const faunaWinsSpeed = result.fauna.speed > result.couchdb.speed;
  const faunaWinsLatency = result.fauna.avg_latency < result.couchdb.avg_latency;
  const faunaWinsConcurrent = (result.concurrent_fauna.conflicts ?? 0) <= (result.concurrent_couchdb.conflicts ?? 0);

  const speedData = [
    { name: 'Fauna', valeur: result.fauna.speed },
    { name: 'CouchDB', valeur: result.couchdb.speed }
  ];

  const latencyData = [
    { name: 'Fauna', valeur: result.fauna.avg_latency },
    { name: 'CouchDB', valeur: result.couchdb.avg_latency }
  ];

  const conflictData = [
    { name: 'Fauna', valeur: result.concurrent_fauna.conflicts ?? 0 },
    { name: 'CouchDB', valeur: result.concurrent_couchdb.conflicts ?? 0 }
  ];

  return (
    <div className="space-y-4">
      {/* Titre */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Zap className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-800">Benchmark : Fauna vs CouchDB</h2>
        </div>
        <span className="text-xs text-gray-400">{new Date(result.timestamp).toLocaleString('fr-FR')}</span>
      </div>

      {/* Deux tableaux côte à côte */}
      <div className="grid grid-cols-2 gap-4">
        {/* Test 1 : Séquentiel */}
        <div className="bg-white rounded-xl p-4 shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center space-x-2">
            <Database className="w-4 h-4 text-indigo-500" />
            <span>Test 1 — Injection séquentielle</span>
          </h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-2 py-2 text-gray-500">Métrique</th>
                <th className="text-center px-2 py-2 text-indigo-600">Fauna</th>
                <th className="text-center px-2 py-2 text-amber-600">CouchDB</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-2 py-2 text-gray-600">Docs injectés</td>
                <td className="px-2 py-2 text-center font-semibold">{result.fauna.docs.toLocaleString()}</td>
                <td className="px-2 py-2 text-center font-semibold">{result.couchdb.docs.toLocaleString()}</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-2 py-2 text-gray-600">Temps (s)</td>
                <td className={`px-2 py-2 text-center font-semibold ${result.fauna.elapsed <= result.couchdb.elapsed ? 'text-green-600' : 'text-red-500'}`}>
                  {result.fauna.elapsed}s
                </td>
                <td className={`px-2 py-2 text-center font-semibold ${result.couchdb.elapsed <= result.fauna.elapsed ? 'text-green-600' : 'text-red-500'}`}>
                  {result.couchdb.elapsed}s
                </td>
              </tr>
              <tr>
                <td className="px-2 py-2 text-gray-600">Vitesse (docs/s)</td>
                <td className={`px-2 py-2 text-center font-semibold ${faunaWinsSpeed ? 'text-green-600' : 'text-red-500'}`}>
                  {result.fauna.speed.toLocaleString()}
                </td>
                <td className={`px-2 py-2 text-center font-semibold ${!faunaWinsSpeed ? 'text-green-600' : 'text-red-500'}`}>
                  {result.couchdb.speed.toLocaleString()}
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-2 py-2 text-gray-600">Latence moy. (ms)</td>
                <td className={`px-2 py-2 text-center font-semibold ${faunaWinsLatency ? 'text-green-600' : 'text-red-500'}`}>
                  {result.fauna.avg_latency}ms
                </td>
                <td className={`px-2 py-2 text-center font-semibold ${!faunaWinsLatency ? 'text-green-600' : 'text-red-500'}`}>
                  {result.couchdb.avg_latency}ms
                </td>
              </tr>
              <tr>
                <td className="px-2 py-2 text-gray-600">Erreurs</td>
                <td className="px-2 py-2 text-center font-semibold">{result.fauna.errors}</td>
                <td className="px-2 py-2 text-center font-semibold">{result.couchdb.errors}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Test 2 : Concurrent */}
        <div className="bg-white rounded-xl p-4 shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center space-x-2">
            <Shield className="w-4 h-4 text-green-500" />
            <span>Test 2 — Concurrence (4 threads) ACID vs non-ACID</span>
          </h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-2 py-2 text-gray-500">Métrique</th>
                <th className="text-center px-2 py-2 text-indigo-600">Fauna</th>
                <th className="text-center px-2 py-2 text-amber-600">CouchDB</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-2 py-2 text-gray-600">Docs injectés</td>
                <td className="px-2 py-2 text-center font-semibold">{result.concurrent_fauna.docs.toLocaleString()}</td>
                <td className="px-2 py-2 text-center font-semibold">{result.concurrent_couchdb.docs.toLocaleString()}</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-2 py-2 text-gray-600">Temps (s)</td>
                <td className={`px-2 py-2 text-center font-semibold ${result.concurrent_fauna.elapsed <= result.concurrent_couchdb.elapsed ? 'text-green-600' : 'text-red-500'}`}>
                  {result.concurrent_fauna.elapsed}s
                </td>
                <td className={`px-2 py-2 text-center font-semibold ${result.concurrent_couchdb.elapsed <= result.concurrent_fauna.elapsed ? 'text-green-600' : 'text-red-500'}`}>
                  {result.concurrent_couchdb.elapsed}s
                </td>
              </tr>
              <tr>
                <td className="px-2 py-2 text-gray-600">Vitesse (docs/s)</td>
                <td className="px-2 py-2 text-center font-semibold">{result.concurrent_fauna.speed.toLocaleString()}</td>
                <td className="px-2 py-2 text-center font-semibold">{result.concurrent_couchdb.speed.toLocaleString()}</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-2 py-2 text-gray-600 font-semibold">⚠️ Conflits</td>
                <td className={`px-2 py-2 text-center font-bold text-lg ${faunaWinsConcurrent ? 'text-green-600' : 'text-red-500'}`}>
                  {result.concurrent_fauna.conflicts ?? 0}
                </td>
                <td className={`px-2 py-2 text-center font-bold text-lg ${!faunaWinsConcurrent ? 'text-green-600' : 'text-red-500'}`}>
                  {result.concurrent_couchdb.conflicts ?? 0}
                </td>
              </tr>
              <tr>
                <td className="px-2 py-2 text-gray-600">Erreurs</td>
                <td className="px-2 py-2 text-center font-semibold">{result.concurrent_fauna.errors}</td>
                <td className="px-2 py-2 text-center font-semibold">{result.concurrent_couchdb.errors}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow">
          <h3 className="text-xs font-medium text-gray-600 mb-2 flex items-center space-x-1">
            <Zap className="w-3 h-3" /><span>Vitesse (docs/s)</span>
          </h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={speedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => [`${v} docs/s`]} />
              <Bar dataKey="valeur" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-4 shadow">
          <h3 className="text-xs font-medium text-gray-600 mb-2 flex items-center space-x-1">
            <Clock className="w-3 h-3" /><span>Latence moyenne (ms)</span>
          </h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={latencyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => [`${v}ms`]} />
              <Bar dataKey="valeur" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-4 shadow">
          <h3 className="text-xs font-medium text-gray-600 mb-2 flex items-center space-x-1">
            <Shield className="w-3 h-3" /><span>Conflits sous concurrence</span>
          </h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={conflictData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => [`${v} conflits`]} />
              <Bar dataKey="valeur" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Test 3 : ACID */}
      {result.acid_fauna && result.acid_couchdb && (
        <div className="bg-white rounded-xl p-4 shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center space-x-2">
            <Shield className="w-4 h-4 text-purple-500" />
            <span>Test 3 — Cohérence ACID : mise à jour concurrente du même document</span>
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            4 threads incrémentent le même compteur simultanément. Valeur attendue : <strong>{result.acid_fauna.expected}</strong>
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className={`rounded-lg p-4 border-2 ${result.acid_fauna.correct ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'}`}>
              <div className="text-sm font-bold text-indigo-700 mb-2">Fauna (ACID)</div>
              <div className="text-3xl font-bold text-gray-800 mb-1">{result.acid_fauna.actual}</div>
              <div className="text-xs text-gray-500">valeur finale</div>
              <div className={`mt-2 text-sm font-semibold ${result.acid_fauna.correct ? 'text-green-700' : 'text-red-600'}`}>
                {result.acid_fauna.correct ? '✅ Résultat exact — aucune perte' : '❌ Données perdues'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Conflits : {result.acid_fauna.conflicts}</div>
            </div>
            <div className={`rounded-lg p-4 border-2 ${result.acid_couchdb.correct ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'}`}>
              <div className="text-sm font-bold text-amber-700 mb-2">CouchDB (sans ACID)</div>
              <div className="text-3xl font-bold text-gray-800 mb-1">{result.acid_couchdb.actual}</div>
              <div className="text-xs text-gray-500">valeur finale</div>
              <div className={`mt-2 text-sm font-semibold ${result.acid_couchdb.correct ? 'text-green-700' : 'text-red-600'}`}>
                {result.acid_couchdb.correct
                  ? '✅ Résultat exact'
                  : `❌ ${result.acid_fauna.expected - result.acid_couchdb.actual} mises à jour perdues`}
              </div>
              <div className="text-xs text-gray-500 mt-1">Conflits : {result.acid_couchdb.conflicts}</div>
            </div>
          </div>
          <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <p className="text-xs text-indigo-700">
              <strong>Conclusion :</strong> Les transactions ACID de Fauna garantissent que chaque mise à jour est appliquée atomiquement.
              CouchDB utilise un système de révisions — sous concurrence, les conflits causent des pertes de données silencieuses.
            </p>
          </div>
        </div>
      )}

      {/* Conclusion */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-lg p-3 ${faunaWinsSpeed ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
          <div className="text-xs font-semibold text-gray-700 mb-1">Vitesse d'injection</div>
          <div className={`text-sm font-bold ${faunaWinsSpeed ? 'text-green-700' : 'text-orange-600'}`}>
            {faunaWinsSpeed ? '✅ Fauna plus rapide' : '⚠️ CouchDB plus rapide'}
          </div>
        </div>
        <div className={`rounded-lg p-3 ${faunaWinsLatency ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
          <div className="text-xs font-semibold text-gray-700 mb-1">Latence</div>
          <div className={`text-sm font-bold ${faunaWinsLatency ? 'text-green-700' : 'text-orange-600'}`}>
            {faunaWinsLatency ? '✅ Fauna moins de latence' : '⚠️ CouchDB moins de latence'}
          </div>
        </div>
        <div className="rounded-lg p-3 bg-green-50 border border-green-200">
          <div className="text-xs font-semibold text-gray-700 mb-1">Cohérence ACID</div>
          <div className="text-sm font-bold text-green-700">✅ Fauna garantit 0 perte</div>
        </div>
      </div>
    </div>
  );
}
