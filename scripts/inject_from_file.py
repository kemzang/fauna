#!/usr/bin/env python3
"""
Lit le fichier généré par generate_data.py et injecte les données dans Fauna
Utilise requests HTTP directement (FQL v10)
pip install requests
"""

import json
import time
import sys
import argparse
from datetime import datetime
from threading import Lock
import requests

stats_lock = Lock()
total_injected = 0
total_errors = 0


class FaunaClient:
    def __init__(self, host, port, secret):
        self.url = f"http://{host}:{port}/query/1"
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {secret}"
        })

    def test(self):
        try:
            r = self.session.post(self.url, json={"query": "{ ok: true }"})
            return r.status_code == 200
        except Exception:
            return False

    def ensure_collection(self):
        try:
            self.session.post(self.url, json={
                "query": 'Collection.byName("Telemetry") ?? Collection.create({ name: "Telemetry" })'
            })
        except Exception as e:
            print(f"Avertissement collection: {e}")

    def insert_batch(self, records):
        fql = f"{json.dumps(records)}.map(doc => Telemetry.create(doc))"
        r = self.session.post(self.url, json={"query": fql})
        if r.status_code != 200:
            raise Exception(f"HTTP {r.status_code}: {r.text}")
        return len(records)


def main():
    global total_injected, total_errors

    parser = argparse.ArgumentParser(description='Injecteur depuis fichier vers Fauna (FQL v10)')
    parser.add_argument('--host', default='localhost')
    parser.add_argument('--port', type=int, default=8443)
    parser.add_argument('--secret', required=True)
    parser.add_argument('--input', default='telemetry_data.json')
    parser.add_argument('--batch-size', type=int, default=20)
    parser.add_argument('--limit', type=int, default=0)
    args = parser.parse_args()

    client = FaunaClient(args.host, args.port, args.secret)

    print("Test de connexion à Fauna...")
    if not client.test():
        print("Échec connexion!")
        sys.exit(1)
    print("Connexion réussie!")

    client.ensure_collection()

    print(f"Injection depuis {args.input} vers {args.host}:{args.port}...")

    try:
        f = open(args.input, 'r')
    except FileNotFoundError:
        print(f"Fichier {args.input} introuvable. Lance d'abord generate_data.py")
        sys.exit(1)

    start_time = time.time()
    batch = []
    count = 0

    with f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
                batch.append(record)
                count += 1
            except json.JSONDecodeError:
                continue

            if len(batch) >= args.batch_size:
                try:
                    client.insert_batch(batch)
                    total_injected += len(batch)
                except Exception:
                    total_errors += len(batch)
                batch = []

            if count % 1000 == 0:
                elapsed = time.time() - start_time
                speed = total_injected / elapsed if elapsed > 0 else 0
                print(f"[{datetime.now().strftime('%H:%M:%S')}] "
                      f"{total_injected:,} injectés | "
                      f"{total_errors} erreurs | "
                      f"{speed:.0f} docs/s")

            if args.limit > 0 and count >= args.limit:
                break

        if batch:
            try:
                client.insert_batch(batch)
                total_injected += len(batch)
            except Exception:
                total_errors += len(batch)

    elapsed = time.time() - start_time
    print(f"\nTerminé! {total_injected:,} docs en {elapsed:.0f}s ({total_injected/elapsed:.0f} docs/s)")
    print(f"Erreurs: {total_errors}")


if __name__ == "__main__":
    main()
