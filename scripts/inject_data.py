#!/usr/bin/env python3
"""
Script d'injection de données pour le TP Fauna Big Data
Injecte simultanément dans Fauna ET CouchDB pour comparaison en temps réel
"""

import time
import random
import sys
import argparse
import threading
import requests
from datetime import datetime
import concurrent.futures

try:
    from faunadb import query as q
    from faunadb.client import FaunaClient
    from faunadb.errors import FaunaError
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
        self.ok = False

    def connect(self):
        try:
            self.client.query(q.now())
            self.ok = True
            # Crée la collection si elle n'existe pas
            self.client.query(
                q.if_(
                    q.exists(q.collection("Telemetry")),
                    True,
                    q.create_collection({"name": "Telemetry"})
                )
            )
            # Crée l'index si nécessaire
            try:
                self.client.query(
                    q.if_(
                        q.exists(q.index("all_telemetry")),
                        True,
                        q.create_index({"name": "all_telemetry", "source": q.collection("Telemetry")})
                    )
                )
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
        except Exception as e:
            return False, 0


# ─── CouchDB ──────────────────────────────────────────────────────────────────

class CouchWriter:
    def __init__(self, host, port, user, password):
        self.base = f"http://{host}:{port}"
        self.db = "telemetry"
        self.session = requests.Session()
        self.session.auth = (user, password)
        self.session.headers.update({"Content-Type": "application/json"})
        self.ok = False

    def connect(self):
        try:
            r = self.session.put(f"{self.base}/{self.db}")
            if r.status_code not in (201, 412):
                print(f"[CouchDB] Impossible de créer la DB: {r.text}")
                return False
            self.ok = True
            return True
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

class DualInjector:
    def __init__(self, fauna: FaunaWriter, couch: CouchWriter, node_id, region):
        self.fauna = fauna
        self.couch = couch
        self.node_id = node_id
        self.region = region
        self.lock = threading.Lock()
        self.stats = {
            "fauna": {"ok": 0, "err": 0, "total_lat": 0.0},
            "couch": {"ok": 0, "err": 0, "total_lat": 0.0},
        }

    def inject_one(self):
        data = generate_telemetry_data(self.node_id, self.region)

        # Injection parallèle dans les deux bases
        results = {}
        def write_fauna():
            ok, lat = self.fauna.write(data)
            results["fauna"] = (ok, lat)
        def write_couch():
            ok, lat = self.couch.write(data)
            results["couch"] = (ok, lat)

        t1 = threading.Thread(target=write_fauna)
        t2 = threading.Thread(target=write_couch)
        t1.start(); t2.start()
        t1.join(); t2.join()

        with self.lock:
            for db in ("fauna", "couch"):
                ok, lat = results.get(db, (False, 0))
                if ok:
                    self.stats[db]["ok"] += 1
                    self.stats[db]["total_lat"] += lat
                else:
                    self.stats[db]["err"] += 1

    def run(self, duration_seconds=300, batch_size=10, delay=1.0):
        print(f"\n{'='*60}")
        print(f"  Injection DUAL — Fauna + CouchDB en parallèle")
        print(f"  Node: {self.node_id} | Région: {self.region}")
        print(f"  Durée: {duration_seconds}s | Batch: {batch_size} | Délai: {delay}s")
        print(f"{'='*60}\n")

        start = time.time()
        batch_num = 0

        while time.time() - start < duration_seconds:
            batch_start = time.time()

            # Injecte batch_size documents en parallèle
            with concurrent.futures.ThreadPoolExecutor(max_workers=batch_size) as ex:
                list(ex.map(lambda _: self.inject_one(), range(batch_size)))

            batch_num += 1
            elapsed = time.time() - start
            f = self.stats["fauna"]
            c = self.stats["couch"]
            f_total = f["ok"] + f["err"]
            c_total = c["ok"] + c["err"]
            f_lat = f["total_lat"] / f["ok"] if f["ok"] > 0 else 0
            c_lat = c["total_lat"] / c["ok"] if c["ok"] > 0 else 0

            print(
                f"[{datetime.now().strftime('%H:%M:%S')}] Batch {batch_num:3d} | "
                f"Fauna: {f['ok']:5d} docs ({f_lat:5.1f}ms) | "
                f"CouchDB: {c['ok']:5d} docs ({c_lat:5.1f}ms) | "
                f"Vitesse: {f_total/elapsed:.0f} docs/s"
            )

            if delay > 0:
                time.sleep(max(0, delay - (time.time() - batch_start)))

        elapsed = time.time() - start
        f = self.stats["fauna"]
        c = self.stats["couch"]
        f_lat = f["total_lat"] / f["ok"] if f["ok"] > 0 else 0
        c_lat = c["total_lat"] / c["ok"] if c["ok"] > 0 else 0

        print(f"\n{'='*60}")
        print(f"  RÉSULTATS FINAUX — {elapsed:.1f}s")
        print(f"{'='*60}")
        print(f"  {'':20s} {'Fauna':>12} {'CouchDB':>12}")
        print(f"  {'Docs injectés':20s} {f['ok']:>12,} {c['ok']:>12,}")
        print(f"  {'Erreurs':20s} {f['err']:>12,} {c['err']:>12,}")
        print(f"  {'Latence moyenne':20s} {f_lat:>11.1f}ms {c_lat:>11.1f}ms")
        print(f"  {'Vitesse (docs/s)':20s} {f['ok']/elapsed:>12.0f} {c['ok']/elapsed:>12.0f}")
        print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(description='Injecteur Dual Fauna+CouchDB — TP Big Data')
    parser.add_argument('--host', default='localhost', help='IP du PC1')
    parser.add_argument('--fauna-port', type=int, default=8443)
    parser.add_argument('--couch-port', type=int, default=5984)
    parser.add_argument('--secret', required=True, help='Clé secrète Fauna')
    parser.add_argument('--couch-user', default='admin')
    parser.add_argument('--couch-password', default='admin')
    parser.add_argument('--node', required=True, help='Nom de ce PC (ex: PC2)')
    parser.add_argument('--region', required=True, help='Région (ex: Europe)')
    parser.add_argument('--duration', type=int, default=300)
    parser.add_argument('--batch-size', type=int, default=10)
    parser.add_argument('--delay', type=float, default=1.0)
    args = parser.parse_args()

    print(f"\nConnexion à Fauna sur {args.host}:{args.fauna_port}...")
    fauna = FaunaWriter(args.host, args.fauna_port, args.secret)
    if not fauna.connect():
        print("❌ Impossible de se connecter à Fauna")
        sys.exit(1)
    print("✅ Fauna connecté")

    print(f"Connexion à CouchDB sur {args.host}:{args.couch_port}...")
    couch = CouchWriter(args.host, args.couch_port, args.couch_user, args.couch_password)
    if not couch.connect():
        print("⚠️  CouchDB non disponible — injection Fauna uniquement")
        couch.ok = False
    else:
        print("✅ CouchDB connecté")

    injector = DualInjector(fauna, couch, args.node, args.region)
    injector.run(args.duration, args.batch_size, args.delay)


if __name__ == "__main__":
    main()
