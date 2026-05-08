#!/usr/bin/env python3
"""
Mini serveur HTTP qui expose les stats Docker de Fauna et CouchDB
Accessible sur http://localhost:9999/stats
pip install docker
"""

import json
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

try:
    import docker
except ImportError:
    print("Module docker manquant. Installez-le avec: pip install docker")
    exit(1)

client = docker.from_env()
cache = {"data": {}, "ts": 0}
CACHE_TTL = 2  # secondes


def get_container_stats(name):
    """Lit les stats d'un conteneur Docker en temps réel"""
    try:
        container = client.containers.get(name)
        stats = container.stats(stream=False)

        # CPU %
        cpu_delta = stats["cpu_stats"]["cpu_usage"]["total_usage"] - \
                    stats["precpu_stats"]["cpu_usage"]["total_usage"]
        system_delta = stats["cpu_stats"]["system_cpu_usage"] - \
                       stats["precpu_stats"]["system_cpu_usage"]
        num_cpus = stats["cpu_stats"].get("online_cpus", 1)
        cpu_pct = (cpu_delta / system_delta) * num_cpus * 100 if system_delta > 0 else 0

        # RAM MB
        mem_usage = stats["memory_stats"]["usage"] / (1024 * 1024)
        mem_limit = stats["memory_stats"]["limit"] / (1024 * 1024)
        mem_pct = (mem_usage / mem_limit) * 100 if mem_limit > 0 else 0

        # Réseau MB
        net_in = sum(v["rx_bytes"] for v in stats["networks"].values()) / (1024 * 1024) if "networks" in stats else 0
        net_out = sum(v["tx_bytes"] for v in stats["networks"].values()) / (1024 * 1024) if "networks" in stats else 0

        return {
            "status": "running",
            "cpu_pct": round(cpu_pct, 2),
            "mem_mb": round(mem_usage, 1),
            "mem_pct": round(mem_pct, 2),
            "net_in_mb": round(net_in, 2),
            "net_out_mb": round(net_out, 2),
        }
    except Exception as e:
        return {"status": "error", "error": str(e), "cpu_pct": 0, "mem_mb": 0, "mem_pct": 0, "net_in_mb": 0, "net_out_mb": 0}


def refresh_cache():
    while True:
        fauna_name = "fauna"
        couch_name = "couchdb"
        cache["data"] = {
            "fauna": get_container_stats(fauna_name),
            "couchdb": get_container_stats(couch_name),
            "ts": int(time.time() * 1000)
        }
        cache["ts"] = time.time()
        time.sleep(CACHE_TTL)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/stats":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(cache["data"]).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # Silence les logs HTTP


if __name__ == "__main__":
    print("Démarrage du serveur de stats Docker sur http://localhost:9999/stats")
    print("Lecture des conteneurs: fauna, couchdb")

    # Démarre le thread de rafraîchissement
    t = threading.Thread(target=refresh_cache, daemon=True)
    t.start()

    # Attend le premier chargement
    time.sleep(2)
    print("Stats disponibles. Ctrl+C pour arrêter.")

    server = HTTPServer(("0.0.0.0", 9999), Handler)
    server.serve_forever()
