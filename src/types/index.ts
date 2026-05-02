export interface TelemetryData {
  timestamp: number;
  node: string;
  region: string;
  latency: number;
  cpu: number;
  memory: number;
  network: number;
}

export interface MachineStats {
  node: string;
  region: string;
  count: number;
  avgLatency: number;
  avgCpu: number;
  avgMemory: number;
  avgNetwork: number;
  lastSeen: number;
}

export interface LatencyData {
  timestamp: number;
  latency: number;
  node: string;
}

export interface ConnectionConfig {
  secret: string;
  domain: string;
  port: number;
}
