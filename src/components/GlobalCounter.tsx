import { useEffect, useState } from 'react';
import { Database, Activity, Zap } from 'lucide-react';
import { getTotalDocumentCount } from '../services/fauna';

export default function GlobalCounter() {
  const [count, setCount] = useState(0);
  const [previousCount, setPreviousCount] = useState(0);
  const [isIncreasing, setIsIncreasing] = useState(false);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const currentCount = await getTotalDocumentCount();
        setCount(currentCount);
        if (currentCount > previousCount) {
          setIsIncreasing(true);
          setTimeout(() => setIsIncreasing(false), 500);
        }
        setPreviousCount(currentCount);
      } catch (error) {
        console.error('Error fetching count:', error);
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 1000);
    return () => clearInterval(interval);
  }, [previousCount]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl px-6 py-4 text-white shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Database className="w-6 h-6" />
          <div>
            <div className="text-xs text-indigo-200">Compteur Global</div>
            <div className={`text-3xl font-bold transition-all duration-300 ${isIncreasing ? 'scale-110' : ''}`}>
              {formatNumber(count)}
            </div>
            <div className="text-xs text-indigo-200">documents Telemetry</div>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <div className="text-center">
            <Zap className="w-4 h-4 mx-auto mb-1" />
            <div className="text-xs text-indigo-200">Vitesse</div>
            <div className="text-sm font-semibold">{Math.max(0, count - previousCount)}/s</div>
          </div>
          <div className="text-center">
            <Activity className={`w-4 h-4 mx-auto mb-1 ${isIncreasing ? 'animate-pulse' : ''}`} />
            <div className="text-xs text-indigo-200">Status</div>
            <div className="text-sm font-semibold text-green-300">Actif</div>
          </div>
        </div>
      </div>
    </div>
  );
}
