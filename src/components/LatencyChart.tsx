import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Clock, TrendingUp } from 'lucide-react';
import { getLatencyData } from '../services/fauna';
import type { LatencyData } from '../types';

export default function LatencyChart() {
  const [latencyData, setLatencyData] = useState<LatencyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLatencyData = async () => {
      try {
        const data = await getLatencyData(100); // Get last 100 records
        setLatencyData(data);
      } catch (error) {
        console.error('Error fetching latency data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLatencyData();
    const interval = setInterval(fetchLatencyData, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-xl">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  const chartData = latencyData.map((data, index) => ({
    time: new Date(data.timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }),
    latency: Math.round(data.latency * 100) / 100,
    node: data.node,
    index
  }));

  const avgLatency = latencyData.length > 0 
    ? latencyData.reduce((sum, data) => sum + data.latency, 0) / latencyData.length 
    : 0;

  const maxLatency = latencyData.length > 0 
    ? Math.max(...latencyData.map(data => data.latency))
    : 0;

  return (
    <div className="bg-white rounded-2xl p-8 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Clock className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-semibold text-gray-800">Latence en Temps Réel</h2>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            Moyenne: <span className="font-semibold text-gray-700">{avgLatency.toFixed(2)}ms</span>
          </div>
          <div className="text-sm text-gray-500">
            Max: <span className="font-semibold text-gray-700">{maxLatency.toFixed(2)}ms</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            label={{ value: 'Latence (ms)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            formatter={(value, name) => [`${value}ms`, 'Latence']}
            labelFormatter={(label) => `Heure: ${label}`}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="latency" 
            stroke="#3B82F6" 
            strokeWidth={2}
            dot={false}
            name="Latence (ms)"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Stats Grid */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <span className="text-xs text-blue-600 font-medium">Performance</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">
            {avgLatency.toFixed(2)}ms
          </div>
          <div className="text-xs text-blue-700 mt-1">Latence moyenne</div>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-green-600" />
            <span className="text-xs text-green-600 font-medium">Maximum</span>
          </div>
          <div className="text-2xl font-bold text-green-900">
            {maxLatency.toFixed(2)}ms
          </div>
          <div className="text-xs text-green-700 mt-1">Pic de latence</div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <span className="text-xs text-purple-600 font-medium">Échantillons</span>
          </div>
          <div className="text-2xl font-bold text-purple-900">
            {latencyData.length}
          </div>
          <div className="text-xs text-purple-700 mt-1">Points de données</div>
        </div>
      </div>

      {latencyData.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>Aucune donnée de latence disponible</p>
          <p className="text-sm mt-2">Les données apparaîtront dès que les scripts commenceront l'injection</p>
        </div>
      )}
    </div>
  );
}
