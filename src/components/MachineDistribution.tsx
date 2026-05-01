import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Monitor, Globe } from 'lucide-react';
import { getMachineStats } from '../services/fauna';
import type { MachineStats } from '../types';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function MachineDistribution() {
  const [stats, setStats] = useState<MachineStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const machineStats = await getMachineStats();
        setStats(machineStats);
      } catch (error) {
        console.error('Error fetching machine stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 3000); // Update every 3 seconds

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

  const chartData = stats.map(stat => ({
    name: stat.node,
    documents: stat.count,
    avgLatency: Math.round(stat.avgLatency * 100) / 100
  }));

  const totalDocuments = stats.reduce((sum, stat) => sum + stat.count, 0);

  return (
    <div className="bg-white rounded-2xl p-8 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Monitor className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-semibold text-gray-800">Répartition par Machine</h2>
        </div>
        <div className="flex items-center space-x-2">
          <Globe className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-500">
            {stats.length} machines actives
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Bar Chart */}
        <div>
          <h3 className="text-sm font-medium text-gray-600 mb-4">Volume de données par machine</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'documents' ? `${value} docs` : `${value}ms`,
                  name === 'documents' ? 'Documents' : 'Latence moyenne'
                ]}
              />
              <Legend />
              <Bar dataKey="documents" fill="#3B82F6" name="Documents" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div>
          <h3 className="text-sm font-medium text-gray-600 mb-4">Distribution en pourcentage</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="documents"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value} docs`, 'Documents']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={stat.node} className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              ></div>
              <span className="text-xs text-gray-500">{stat.node}</span>
            </div>
            <div className="text-lg font-semibold text-gray-800">
              {stat.count.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">
              {stat.avgLatency.toFixed(2)}ms avg
            </div>
          </div>
        ))}
      </div>

      {stats.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Monitor className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>Aucune donnée reçue pour le moment</p>
          <p className="text-sm mt-2">Lancez les scripts d'injection pour voir les données apparaître</p>
        </div>
      )}
    </div>
  );
}
