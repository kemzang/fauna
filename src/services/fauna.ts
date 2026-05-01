import type { TelemetryData, MachineStats, LatencyData } from '../types';

let faundaConfig: { secret: string; domain: string; port: number } | null = null;

export const initializeFauna = (secret: string, domain: string = 'localhost', port: number = 8443) => {
  faundaConfig = { secret, domain, port };
};

export const fqlQuery = async (query: string) => {
  if (!faundaConfig) throw new Error('Fauna not initialized');
  const { secret, domain, port } = faundaConfig;

  const response = await fetch(`http://${domain}:${port}/query/1`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secret}`
    },
    body: JSON.stringify({ query })
  });

  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message || JSON.stringify(json));
  return json;
};

export const testConnection = async (): Promise<boolean> => {
  try {
    await fqlQuery('{ ok: true }');
    return true;
  } catch (error: any) {
    console.error('testConnection error:', error?.message || error);
    return false;
  }
};

export const ensureCollection = async (collectionName: string) => {
  try {
    await fqlQuery(`Collection.byName("${collectionName}") ?? Collection.create({ name: "${collectionName}" })`);
  } catch (e) {
    // ignore if already exists
  }
};

export const createTelemetryIndex = async () => {
  // indexes are not needed in FQL v10, queries work without them
};

export const insertTelemetryData = async (data: TelemetryData) => {
  return await fqlQuery(`Telemetry.create(${JSON.stringify(data)})`);
};

export const getTotalDocumentCount = async (): Promise<number> => {
  try {
    const result = await fqlQuery('Telemetry.all().count()');
    return Number(result?.data) || 0;
  } catch {
    return 0;
  }
};

export const getMachineStats = async (): Promise<MachineStats[]> => {
  try {
    // Get up to 5000 docs and group by node client-side
    const result = await fqlQuery('Telemetry.all().paginate(5000)');
    const docs: any[] = result?.data?.data || [];

    const stats: { [key: string]: { count: number; totalLatency: number } } = {};
    docs.forEach((doc: any) => {
      const node = doc.node || doc.data?.node;
      const latency = doc.latency || doc.data?.latency || 0;
      if (!node) return;
      if (!stats[node]) stats[node] = { count: 0, totalLatency: 0 };
      stats[node].count++;
      stats[node].totalLatency += latency;
    });

    return Object.entries(stats).map(([node, s]) => ({
      node,
      count: s.count,
      avgLatency: s.count > 0 ? s.totalLatency / s.count : 0
    }));
  } catch {
    return [];
  }
};

export const getLatencyData = async (limit: number = 100): Promise<LatencyData[]> => {
  try {
    const result = await fqlQuery(`Telemetry.all().paginate(${limit})`);
    const docs: any[] = result?.data?.data || [];

    return docs.map((doc: any) => ({
      timestamp: doc.timestamp || doc.data?.timestamp || Date.now(),
      latency: doc.latency || doc.data?.latency || 0,
      node: doc.node || doc.data?.node || 'unknown'
    }));
  } catch {
    return [];
  }
};
