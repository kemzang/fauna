import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, Legend,
} from 'recharts';
import { Zap, Shield, Database, TrendingUp } from 'lucide-react';
import { getTotalDocumentCount, getLatencyData, getCouchDBDocCount, getCouchDBAvgLatency } from '../services/fauna';

const FAUNA_COLOR = '#6366f1';
const COUCH_COLOR = '#f59e0b';

interface Snapshot {
  time: string;
  fauna: number;
  couch: number;
  faunaLat: number;
  couchLat: number;
}

export default function LiveComparison() {
  const [faunaDocs, setFaunaDocs] = useState(0);
  const [couchDocs, setCouchDocs] = useState(0);
  const [faunaLat, setFaunaLat] = useState(0);
  const [couchLat, setCouchLat] = useState(0);
  const [history, setHistory] = useState<Snapshot[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const [fd, cd, latData, cl] = await Promise.all([
        getTotalDocumentCount(),
        getCouchDBDocCount(),
        getLatencyData(200),
        getCouchDBAvgLatency(),
      ]);

      const fl = latData.length > 0
        ? latData.reduce((s, d) => s + d.latency, 0) / latData.length
        : 0;

      setFaunaDocs(fd);
      setCouchDocs(cd);
      setFaunaLat(fl);
      setCouchLat(cl);

      const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setHistory(prev => [...prev.slice(-30), {
        time: now, fauna: fd, couch: cd,
        faunaLat: parseFloat(fl.toFixed(1)),
        couchLat: parseFloat(cl.toFixed(1)),
      }]);
    };

    fetch();
    const interval = setInterval(fetch, 2000);
    return () => clearInterval(interval);
  }, []);

  const barData = [
    { name: 'Fauna', docs: faunaDocs, fill: FAUNA_COLOR },
    { name: 'CouchDB', docs: couchDocs, fill: COUCH_COLOR },
  ];

  const latData = [
    { name: 'Fauna', lat: parseFloat(faunaLat.toFixed(1)), fill: FAUNA_COLOR },
    { name: 'CouchDB', lat: parseFloat(couchLat.toFixed(1)), fill: COUCH_COLOR },
  ];

  const faunaWinsDocs = faunaDocs >= couchDocs;
  const faunaWinsLat = faunaLat <= couchLat && faunaLat > 0;

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-white" />
          <span className="font-semibold text-white text-sm">Comparaison Live — Fauna vs CouchDB</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-indigo-200">Temps réel</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* KPIs côte à côte */}
        <div className="grid grid-cols-2 gap-3">
          {/* Fauna */}
          <div className="rounded-xl p-3 border-2 border-indigo-200 bg-indigo-50">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-indigo-500" />
              <span className="font-bold text-indigo-700 text-sm">Fauna</span>
              {faunaWinsDocs && <span className="ml-auto text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">🏆 Leader</span>}
            </div>
            <div className="text-3xl font-black text-indigo-800">{faunaDocs.toLocaleString()}</div>
            <div className="text-xs text-indigo-500 mt-0.5">documents</div>
            <div className="mt-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-indigo-400" />
              <span className="text-xs text-indigo-600 font-medium">{faunaLat.toFixed(1)}ms latence moy.</span>
            </div>
          </div>

          {/* CouchDB */}
          <div className="rounded-xl p-3 border-2 border-amber-200 bg-amber-50">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="font-bold text-amber-700 text-sm">CouchDB</span>
              {!faunaWinsDocs && <span className="ml-auto text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">🏆 Leader</span>}
            </div>
            <div className="text-3xl font-black text-amber-800">{couchDocs.toLocaleString()}</div>
            <div className="text-xs text-amber-500 mt-0.5">documents</div>
            <div className="mt-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-amber-400" />
              <span className="text-xs text-amber-600 font-medium">{couchLat.toFixed(1)}ms latence moy.</span>
            </div>
          </div>
        </div>

        {/* Avantage */}
        {(faunaDocs > 0 || couchDocs > 0) && (
          <div className={`rounded-lg p-2.5 text-xs font-medium flex items-center gap-2 ${faunaWinsDocs ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
            <Shield className="w-3.5 h-3.5 flex-shrink-0" />
            {faunaWinsDocs
              ? `Fauna a ingéré ${(faunaDocs - couchDocs).toLocaleString()} docs de plus que CouchDB`
              : `CouchDB a ingéré ${(couchDocs - faunaDocs).toLocaleString()} docs de plus que Fauna`
            }
            {faunaWinsLat && faunaLat > 0 && ` · Fauna ${(couchLat - faunaLat).toFixed(1)}ms plus rapide`}
          </div>
        )}

        {/* Graphiques */}
        <div className="grid grid-cols-2 gap-3">
          {/* Docs */}
          <div>
            <div className="text-xs text-gray-500 font-medium mb-1 flex items-center gap-1">
              <Database className="w-3 h-3" /> Documents ingérés
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Documents']} contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="docs" radius={[4, 4, 0, 0]}>
                  {barData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Latence */}
          <div>
            <div className="text-xs text-gray-500 font-medium mb-1 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Latence moyenne (ms)
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={latData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: number) => [`${v}ms`, 'Latence']} contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="lat" radius={[4, 4, 0, 0]}>
                  {latData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Évolution dans le temps */}
        {history.length > 2 && (
          <div>
            <div className="text-xs text-gray-500 font-medium mb-1">Évolution du volume dans le temps</div>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={history} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 8 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ fontSize: 10 }} formatter={(v: number) => [v.toLocaleString()]} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="fauna" stroke={FAUNA_COLOR} strokeWidth={2} dot={false} name="Fauna" />
                <Line type="monotone" dataKey="couch" stroke={COUCH_COLOR} strokeWidth={2} dot={false} name="CouchDB" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
