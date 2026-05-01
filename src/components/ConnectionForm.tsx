import { useState } from 'react';
import { Database, Server } from 'lucide-react';
import { initializeFauna, testConnection, ensureCollection, createTelemetryIndex } from '../services/fauna';
import type { ConnectionConfig } from '../types';

interface ConnectionFormProps {
  onConnect: (config: ConnectionConfig) => void;
}

export default function ConnectionForm({ onConnect }: ConnectionFormProps) {
  const [config, setConfig] = useState<ConnectionConfig>({
    secret: '',
    domain: 'localhost',
    port: 8443
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Initialize Fauna client
      initializeFauna(config.secret, config.domain, config.port);
      
      // Test connection
      const isConnected = await testConnection();
      if (!isConnected) {
        throw new Error('Impossible de se connecter à Fauna. Vérifiez vos paramètres.');
      }

      // Setup database structure
      await ensureCollection('Telemetry');
      await createTelemetryIndex();

      onConnect(config);
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <div className="bg-indigo-100 p-3 rounded-full">
            <Database className="w-8 h-8 text-indigo-600" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
          Fauna Dashboard
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Interface de monitoring pour votre TP Big Data
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Secret Key Fauna
            </label>
            <input
              type="password"
              value={config.secret}
              onChange={(e) => setConfig({ ...config, secret: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Votre secret key Fauna"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Domaine
              </label>
              <input
                type="text"
                value={config.domain}
                onChange={(e) => setConfig({ ...config, domain: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="localhost"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Port
              </label>
              <input
                type="number"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="8443"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Connexion en cours...
              </>
            ) : (
              <>
                <Server className="w-5 h-5 mr-2" />
                Se connecter
              </>
            )}
          </button>
        </form>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-700 mb-2">Instructions:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>1. Démarrez Fauna avec Docker sur le port 8443</li>
            <li>2. Créez une database et générez une clé secrète</li>
            <li>3. Lancez les scripts d'injection sur les autres machines</li>
            <li>4. Observez les données en temps réel!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
