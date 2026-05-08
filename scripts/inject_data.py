#!/usr/bin/env python3
"""
Script d'injection de données pour le TP Fauna Big Data
Injecte simultanément dans Fauna ET CouchDB
"""

import time
import random
import sys
import argparse
import threading
from datetime import datetime
import requests

try:
    from faunadb import query as q
    from faunadb.client import FaunaClient
    from faunadb.errors import FaunaError
    FaunaClient.check_new_version = lambda self: None
except ImportError:
    print("SDK faunadb manquant. Installez-le avec: pip install faunadb requests")
    sys.exit(1)


def generate_telemetry_data(node_id, region):
    return {
        "timestamp": int(time.time() * 1000),
        "node": node_id,
        "region": region,
        "latency": round(random.uniform(10, 150), 2),
        "cpu": round(random.uniform(20, 90), 2),
        "memory": round(random.uniform(30, 85), 2),
        "network": round(random.uniform(100, 1000), 2)
    }


# ─── Fauna ────────────────────────────────────────────────────────────────────

class FaunaWriter:
    def __init__(self, host, port, secret):
        self.client = FaunaClient(secret=secret, domain=host, port=port, scheme="http")

    def connect(self):
        try:
            self.client.query(q.now())
            self.client.query(q.if_(
                q.exists(q.collection("Telemetry")), True,
                q.create_collection({"name": "Telemetry"})
            ))
            try:
                self.client.query(q.if_(
                    q.exists(q.index("all_telemetry")), True,
                    q.create_index({"name": "all_telemetry", "source": q.collection("Telemetry")})
                ))
            except Exception:
                pass
            return True
        except Exception as e:
            print(f"[Fauna] Erreur connexion: {e}")
            return False

    def write(self, data):
        t0 = time.time()
        try:
            self.client.query(q.create(q.collection("Telemetry"), {"data": data}))
            return True, (time.time() - t0) * 1000
        except Exception:
            return False, 0


# ─── CouchDB ──────────────────────────────────────────────────────────────────

class CouchWriter:
    def __init__(self, host, port, user, password):
        self.base = f"http://{host}:{port}"
        self.db = "telemetry"
        self.session = requests.Session()
        self.session.auth = (user, password)
        self.session.headers.update({"Content-Type": "application/json"})

    def connect(self):
        try:
            r = self.session.put(f"{self.base}/{self.db}")
            return r.status_code in (201, 412)
        except Exception as e:
            print(f"[CouchDB] Erreur connexion: {e}")
            return False

    def write(self, data):
        t0 = time.time()
        try:
            r = self.session.post(f"{self.base}/{self.db}", json=data)
            return r.status_code == 201, (time.time() - t0) * 1000
        except Exception:
            return False, 0


# ─── Injecteur dual ───────────────────────────────────────────────────────────

def run(fauna: FaunaWriter, couch: CouchWriter, node_id, region, duration, batch_size, delay):
    lock = threading.Lock()
    stats = {
        "fauna": {"ok": 0, "err": 0, "lat": 0.0},
        "couch": {"ok": 0, "err": 0, "lat": 0.0},
    }

    def inject_one():
        data = generate_telemetry_data(node_id, region)
        results = {}

        def wf():
            ok, lat = fauna.write(data)
            results["fauna"] = (ok, lat)

        def wc():
            ok, lat = couch.write(data)
            results["couch"] = (ok, lat)

        t1 = threading.Thread(target=wf)
        t2 = threading.Thread(target=wc)
        t1.start(); t2.start()
        t1.join(); t2.join()

        with lock:
            for db in ("fauna", "couch"):
                ok, lat = results.get(db, (False, 0))
                if ok:
                    stats[db]["ok"] += 1
                    stats[db]["lat"] += lat
                else:
                    stats[db]["err"] += 1

    print(f"\n{'='*60}")
    print(f"  Injection DUAL — Fauna + CouchDB")
    print(f"  Node: {node_id} | Région: {region} | Durée: {duration}s")
    print(f"{'='*60}\n")

    start = time.time()
    batch_num = 0

    while time.time() - start < duration:
        batch_start = time.time()
        threads = [threading.Thread(target=inject_one) for _ in range(batch_size)]
        for t in threads: t.start()
        for t in threads: t.join()

        batch_num += 1
        elapsed = time.time() - start
        f = stats["fauna"]
        c = stats["couch"]
        f_lat = f["lat"] / f["ok"] if f["ok"] > 0 else 0
        c_lat = c["lat"] / c["ok"] if c["ok"] > 0 else 0

        print(
            f"[{datetime.now().strftime('%H:%M:%S')}] Batch {batch_num:3d} | "
            f"Fauna: {f['ok']:5d} docs ({f_lat:5.1f}ms) | "
            f"CouchDB: {c['ok']:5d} docs ({c_lat:5.1f}ms) | "
            f"{(f['ok']+c['ok'])/elapsed:.0f} ops/s"
        )

        remaining = delay - (time.time() - batch_start)
        if remaining > 0:
            time.sleep(remaining)

    elapsed = time.time() - start
    f = stats["fauna"]
    c = stats["couch"]
    print(f"\n{'='*60}")
    print(f"  RÉSULTATS — {elapsed:.1f}s")
    print(f"  {'':20s} {'Fauna':>12} {'CouchDB':>12}")
    print(f"  {'Docs injectés':20s} {f['ok']:>12,} {c['ok']:>12,}")
    print(f"  {'Erreurs':20s} {f['err']:>12,} {c['err']:>12,}")
    f_lat = f["lat"] / f["ok"] if f["ok"] > 0 else 0
    c_lat = c["lat"] / c["ok"] if c["ok"] > 0 else 0
    print(f"  {'Latence moyenne':20s} {f_lat:>11.1f}ms {c_lat:>11.1f}ms")
    print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(description='Injecteur Dual Fauna+CouchDB')
    parser.add_argument('--host', default='localhost')
    parser.add_argument('--port', type=int, default=8443)
    parser.add_argument('--secret', required=True)
    parser.add_argument('--couch-port', type=int, default=5984)
    parser.add_argument('--couch-user', default='admin')
    parser.add_argument('--couch-password', default='admin')
    parser.add_argument('--node', required=True)
    parser.add_argument('--region', required=True)
    parser.add_argument('--duration', type=int, default=300)
    parser.add_argument('--batch-size', type=int, default=10)
    parser.add_argument('--delay', type=float, default=1.0)
    args = parser.parse_args()

    print(f"Connexion à Fauna sur {args.host}:{args.port}...")
    fauna = FaunaWriter(args.host, args.port, args.secret)
    if not fauna.connect():
        print("❌ Impossible de se connecter à Fauna")
        sys.exit(1)
    print("✅ Fauna connecté")

    print(f"Connexion à CouchDB sur {args.host}:{args.couch_port}...")
    couch = CouchWriter(args.host, args.couch_port, args.couch_user, args.couch_password)
    if not couch.connect():
        print("⚠️  CouchDB non disponible — injection Fauna uniquement")
    else:
        print("✅ CouchDB connecté")

    run(fauna, couch, args.node, args.region, args.duration, args.batch_size, args.delay)


if __name__ == "__main__":
    main()
