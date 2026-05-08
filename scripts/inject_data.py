#!/usr/bin/env python3
"""
Script d'injection de données pour le TP Fauna Big Data
Utilise le SDK faunadb (FQL v4) - compatible avec fauna/faunadb Docker
"""

import time
import random
import sys
import argparse
from datetime import datetime
import concurrent.futures

try:
    from faunadb import query as q
    from faunadb.client import FaunaClient
    from faunadb.errors import FaunaError
    # Désactiver la vérification de version (évite l'appel à pypi.org sans internet)
    FaunaClient.check_new_version = lambda self: None
except ImportError:
    print("SDK faunadb manquant. Installez-le avec: pip install faunadb")
    sys.exit(1)


class FaunaInjector:
    def __init__(self, fauna_host, fauna_port, secret_key, node_id, region):
        self.client = FaunaClient(
            secret=secret_key,
            domain=fauna_host,
            port=fauna_port,
            scheme="http"
        )
        self.node_id = node_id
        self.region = region

    def generate_telemetry_data(self):
        return {
            "timestamp": int(time.time() * 1000),
            "node": self.node_id,
            "region": self.region,
            "latency": round(random.uniform(10, 150), 2),
            "cpu": round(random.uniform(20, 90), 2),
            "memory": round(random.uniform(30, 85), 2),
            "network": round(random.uniform(100, 1000), 2)
        }

    def test_connection(self):
        try:
            self.client.query(q.now())
            return True
        except Exception as e:
            print(f"Erreur: {e}")
            return False

    def ensure_collection(self):
        try:
            self.client.query(
                q.if_(
                    q.exists(q.collection("Telemetry")),
                    True,
                    q.create_collection({"name": "Telemetry"})
                )
            )
        except FaunaError as e:
            print(f"Avertissement collection: {e}")

    def inject_single_document(self):
        try:
            data = self.generate_telemetry_data()
            self.client.query(
                q.create(q.collection("Telemetry"), {"data": data})
            )
            return True
        except FaunaError as e:
            print(f"Erreur injection: {e}")
            return False

    def inject_batch(self, batch_size=10):
        successes = 0
        for _ in range(batch_size):
            if self.inject_single_document():
                successes += 1
        return successes

    def continuous_injection(self, duration_seconds=300, batch_size=10, delay=1):
        print(f"Démarrage injection pour {duration_seconds}s | Node: {self.node_id} | Region: {self.region}")

        start_time = time.time()
        total_injected = 0
        total_batches = 0

        while time.time() - start_time < duration_seconds:
            batch_start = time.time()
            successes = self.inject_batch(batch_size)
            total_injected += successes
            total_batches += 1
            elapsed = time.time() - start_time

            print(f"[{datetime.now().strftime('%H:%M:%S')}] "
                  f"Batch {total_batches}: {successes}/{batch_size} | "
                  f"Total: {total_injected} | "
                  f"Vitesse: {total_injected/elapsed:.1f} docs/s | "
                  f"Temps: {time.time()-batch_start:.2f}s")

            if delay > 0:
                time.sleep(delay)

        total_time = time.time() - start_time
        print(f"\nTerminé! {total_injected} docs en {total_time:.2f}s ({total_injected/total_time:.1f} docs/s)")
        return total_injected

    def stress_test(self, threads=4, duration_seconds=60):
        print(f"Stress test: {threads} threads pendant {duration_seconds}s")

        def worker(thread_id):
            count = 0
            start = time.time()
            while time.time() - start < duration_seconds:
                if self.inject_single_document():
                    count += 1
            print(f"Thread {thread_id}: {count} docs")
            return count

        with concurrent.futures.ThreadPoolExecutor(max_workers=threads) as executor:
            futures = [executor.submit(worker, i) for i in range(threads)]
            total = sum(f.result() for f in concurrent.futures.as_completed(futures))

        print(f"\nStress test terminé! {total} docs ({total/duration_seconds:.1f} docs/s)")
        return total


def main():
    parser = argparse.ArgumentParser(description='Injecteur Fauna TP Big Data')
    parser.add_argument('--host', default='localhost')
    parser.add_argument('--port', type=int, default=8443)
    parser.add_argument('--secret', required=True)
    parser.add_argument('--node', required=True)
    parser.add_argument('--region', required=True)
    parser.add_argument('--duration', type=int, default=300)
    parser.add_argument('--batch-size', type=int, default=10)
    parser.add_argument('--delay', type=float, default=1.0)
    parser.add_argument('--stress', action='store_true')
    parser.add_argument('--threads', type=int, default=4)
    args = parser.parse_args()

    injector = FaunaInjector(args.host, args.port, args.secret, args.node, args.region)

    print("Test de connexion à Fauna...")
    if not injector.test_connection():
        print("Échec de la connexion!")
        sys.exit(1)
    print("Connexion réussie!")

    injector.ensure_collection()

    if args.stress:
        injector.stress_test(args.threads, args.duration)
    else:
        injector.continuous_injection(args.duration, args.batch_size, args.delay)


if __name__ == "__main__":
    main()
