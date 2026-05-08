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

export interface DockerStats {
  cpu_pct: number;
  mem_mb: number;
  mem_pct: number;
  net_in_mb: number;
  net_out_mb: number;
  status: string;
}
