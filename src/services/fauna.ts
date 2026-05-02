/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client, query as q } from 'faunadb';
import type { MachineStats, LatencyData } from '../types';

let faunaClient: Client | null = null;

export const initializeFauna = (secret: string, domain: string = 'localhost', port: number = 8443) => {
  faunaClient = new Client({ secret, domain, port, scheme: 'http' });
};

// Utilisé par BenchmarkDashboard
export const fqlQuery = async (fqlString: string): Promise<any> => {
  if (!faunaClient) throw new Error('Fauna not initialized');
  if (fqlString.includes('BenchmarkResults')) {
    return faunaClient.query(
      q.Map(
        q.Paginate(q.Documents(q.Collection('BenchmarkResults')), { size: 100 }),
        q.Lambda('ref', q.Get(q.Var('ref')))
      )
    ).then((res: any) => ({
      data: { data: (res.data || []).map((d: any) => d.data) }
    }));
  }
  throw new Error(`fqlQuery: requête non supportée: ${fqlString}`);
};

export const testConnection = async (): Promise<boolean> => {
  if (!faunaClient) return false;
  try {
    await faunaClient.query(q.Now());
    return true;
  } catch (error: any) {
    console.error('testConnection error:', error?.message || error);
    return false;
  }
};

export const ensureCollection = async (collectionName: string) => {
  if (!faunaClient) return;
  try {
    await faunaClient.query(
      q.If(q.Exists(q.Collection(collectionName)), true, q.CreateCollection({ name: collectionName }))
    );
  } catch { /* ignore */ }
};

export const createTelemetryIndex = async () => {
  if (!faunaClient) return;
  const indexes = [
    { name: 'all_telemetry', collection: 'Telemetry' },
    { name: 'all_benchmark_results', collection: 'BenchmarkResults' },
  ];
  for (const idx of indexes) {
    try {
      await faunaClient.query(
        q.If(
          q.Exists(q.Index(idx.name)),
          true,
          q.CreateIndex({ name: idx.name, source: q.Collection(idx.collection) })
        )
      );
    } catch { /* ignore */ }
  }
};

export const getTotalDocumentCount = async (): Promise<number> => {
  if (!faunaClient) return 0;
  try {
    const result: any = await faunaClient.query(q.Count(q.Match(q.Index('all_telemetry'))));
    return Number(result) || 0;
  } catch { return 0; }
};

export const getMachineStats = async (): Promise<MachineStats[]> => {
  if (!faunaClient) return [];
  try {
    const result: any = await faunaClient.query(
      q.Map(
        q.Paginate(q.Match(q.Index('all_telemetry')), { size: 5000 }),
        q.Lambda('ref', q.Get(q.Var('ref')))
      )
    );
    const docs: any[] = result?.data || [];
    const stats: {
      [key: string]: {
        count: number; region: string;
        totalLatency: number; totalCpu: number;
        totalMemory: number; totalNetwork: number;
        lastSeen: number;
      }
    } = {};

    docs.forEach((doc: any) => {
      const d = doc?.data;
      if (!d?.node) return;
      if (!stats[d.node]) {
        stats[d.node] = { count: 0, region: d.region || '?', totalLatency: 0, totalCpu: 0, totalMemory: 0, totalNetwork: 0, lastSeen: 0 };
      }
      stats[d.node].count++;
      stats[d.node].totalLatency += d.latency || 0;
      stats[d.node].totalCpu += d.cpu || 0;
      stats[d.node].totalMemory += d.memory || 0;
      stats[d.node].totalNetwork += d.network || 0;
      if ((d.timestamp || 0) > stats[d.node].lastSeen) stats[d.node].lastSeen = d.timestamp;
    });

    return Object.entries(stats).map(([node, s]) => ({
      node, region: s.region, count: s.count,
      avgLatency: s.count > 0 ? s.totalLatency / s.count : 0,
      avgCpu: s.count > 0 ? s.totalCpu / s.count : 0,
      avgMemory: s.count > 0 ? s.totalMemory / s.count : 0,
      avgNetwork: s.count > 0 ? s.totalNetwork / s.count : 0,
      lastSeen: s.lastSeen,
    }));
  } catch { return []; }
};

export const getLatencyData = async (limit: number = 100): Promise<LatencyData[]> => {
  if (!faunaClient) return [];
  try {
    const result: any = await faunaClient.query(
      q.Map(
        q.Paginate(q.Match(q.Index('all_telemetry')), { size: limit }),
        q.Lambda('ref', q.Get(q.Var('ref')))
      )
    );
    return (result?.data || []).map((doc: any) => ({
      timestamp: doc?.data?.timestamp || Date.now(),
      latency: doc?.data?.latency || 0,
      node: doc?.data?.node || 'unknown',
    }));
  } catch { return []; }
};
