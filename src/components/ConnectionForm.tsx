import { useState } from 'react';
import { Server, Lock, Globe, Hash, Loader2 } from 'lucide-react';
import { initializeFauna, initializeCouchDB, testConnection, ensureCollection, createTelemetryIndex } from '../services/fauna'; // eslint-disable-line @typescript-eslint/no-unused-vars
import type { ConnectionConfig } from '../types';

interface Props { onConnect: (config: ConnectionConfig) => void; }

export default function ConnectionForm({ onConnect }: Props) {
  const [config, setConfig] = useState<ConnectionConfig>({ secret: '', domain: 'localhost', port: 8443 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      initializeFauna(config.secret, config.domain, config.port);
      initializeCouchDB(config.domain, 5984);
      if (!await testConnection()) throw new Error('Impossible de se connecter à Fauna. Vérifiez vos paramètres.');
      await ensureCollection('Telemetry');
      await createTelemetryIndex();
      onConnect(config);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-sm shadow-2xl shadow-black/50">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/20">
              <span className="text-indigo-400 font-black text-3xl">F</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Fauna Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">Interface de monitoring Big Data</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Secret */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Secret Key</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="password" value={config.secret}
                  onChange={e => setConfig({ ...config, secret: e.target.value })}
                  className="w-full bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-colors"
                  placeholder="fnA..." required />
              </div>
            </div>

            {/* Domain + Port */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Domaine</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="text" value={config.domain}
                    onChange={e => setConfig({ ...config, domain: e.target.value })}
                    className="w-full bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-colors"
                    placeholder="localhost" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Port</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="number" value={config.port}
                    onChange={e => setConfig({ ...config, port: parseInt(e.target.value) })}
                    className="w-full bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-colors"
                    placeholder="8443" />
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 mt-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Connexion...</> : <><Server className="w-4 h-4" />Se connecter</>}
            </button>
          </form>

          {/* Instructions */}
          <div className="mt-6 bg-slate-800/50 border border-slate-700/30 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Instructions</p>
            <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
              <li>Démarrez Fauna avec Docker sur le port 8443</li>
              <li>Créez une database et générez une clé secrète</li>
              <li>Lancez les scripts d'injection sur les autres machines</li>
              <li>Observez les données en temps réel</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
