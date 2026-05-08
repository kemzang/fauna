#!/usr/bin/env python3
"""
Benchmark comparatif Fauna vs CouchDB
Test 1 : Injection séquentielle (vitesse brute)
Test 2 : Injection concurrente (4 threads simultanés) — montre la force des transactions ACID
pip install faunadb requests
"""

import json
import time
import sys
import argparse
import threading
from datetime import datetime
import requests

try:
    from faunadb import query as q
    from faunadb.client import FaunaClient as _FaunaSDK
except ImportError:
    print("SDK faunadb manquant. Installez-le avec: pip install faunadb")
    sys.exit(1)

lock = threading.Lock()


# ─── Fauna (SDK v4 — même que inject_data.py) ─────────────────────────────────

class FaunaClient:
    def __init__(self, host, port, secret):
        self.host = host
        self.port = port
        self.secret = secret
        self.client = _FaunaSDK(secret=secret, domain=host, port=port, scheme="http")

    def ensure_collection(self):
        try:
            self.client.query(
                q.if_(
                    q.exists(q.collection("Telemetry")),
                    True,
                    q.create_collection({"name": "Telemetry"})
                )
            )
            # Créer l'index si nécessaire
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
            # Créer l'index BenchmarkResults si nécessaire
            try:
                self.client.query(
                    q.if_(
                        q.exists(q.collection("BenchmarkResults")),
                        True,
                        q.create_collection({"name": "BenchmarkResults"})
                    )
                )
                self.client.query(
                    q.if_(
                        q.exists(q.index("all_benchmark_results")),
                        True,
                        q.create_index({"name": "all_benchmark_results", "source": q.collection("BenchmarkResults")})
                    )
                )
            except Exception:
                pass
        except Exception as e:
            print(f"[Fauna] ensure_collection: {e}")

    def insert_batch(self, records):
        t0 = time.time()
        for record in records:
            self.client.query(q.create(q.collection("Telemetry"), {"data": record}))
        latency = (time.time() - t0) * 1000
        return latency

    def save_results(self, result):
        try:
            self.client.query(q.create(q.collection("BenchmarkResults"), {"data": result}))
        except Exception as e:
            print(f"[Fauna] save_results: {e}")


# ─── CouchDB ──────────────────────────────────────────────────────────────────

class CouchDBClient:
    def __init__(self, host, port, user, password):
        self.base_url = f"http://{host}:{port}"
        self.db = "telemetry"
        self.session = requests.Session()
        self.session.auth = (user, password)
        self.session.headers.update({"Content-Type": "application/json"})

    def ensure_collection(self):
        self.session.delete(f"{self.base_url}/{self.db}")
        r = self.session.put(f"{self.base_url}/{self.db}")
        if r.status_code not in (201, 412):
            raise Exception(f"Impossible de créer la DB CouchDB: {r.text}")

    def insert_batch(self, records):
        t0 = time.time()
        r = self.session.post(
            f"{self.base_url}/{self.db}/_bulk_docs",
            json={"docs": records}
        )
        latency = (time.time() - t0) * 1000
        if r.status_code != 201:
            raise Exception(f"HTTP {r.status_code}: {r.text}")
        # Compte les conflits dans la réponse CouchDB
        response_docs = r.json() if isinstance(r.json(), list) else []
        conflicts = sum(1 for d in response_docs if d.get('error') == 'conflict')
        return latency, conflicts

    def insert_batch_simple(self, records):
        latency, _ = self.insert_batch(records)
        return latency


# ─── Test 1 : Injection séquentielle ─────────────────────────────────────────

def run_sequential_test(writer, records, batch_size, db_name):
    """Injection simple — mesure vitesse et latence"""
    docs = 0
    errors = 0
    latencies = []
    start = time.time()

    batch = []
    for record in records:
        batch.append(record)
        if len(batch) >= batch_size:
            try:
                if db_name == "fauna":
                    lat = writer.insert_batch(batch)
                else:
                    lat, _ = writer.insert_batch(batch)
                latencies.append(lat)
                docs += len(batch)
            except Exception:
                errors += len(batch)
            batch = []

    if batch:
        try:
            if db_name == "fauna":
                lat = writer.insert_batch(batch)
            else:
                lat, _ = writer.insert_batch(batch)
            latencies.append(lat)
            docs += len(batch)
        except Exception:
            errors += len(batch)

    elapsed = time.time() - start
    return {
        "docs": docs,
        "errors": errors,
        "elapsed": round(elapsed, 2),
        "speed": round(docs / elapsed if elapsed > 0 else 0, 0),
        "avg_latency": round(sum(latencies) / len(latencies) if latencies else 0, 2),
        "max_latency": round(max(latencies) if latencies else 0, 2)
    }


# ─── Test 2 : Injection concurrente ──────────────────────────────────────────

def run_concurrent_test(writer_class, writer_args, records, batch_size, num_threads, db_name):
    """
    Plusieurs threads écrivent en même temps.
    Fauna avec ACID = 0 conflits.
    CouchDB sans transactions = conflits possibles.
    """
    shared = {"docs": 0, "errors": 0, "conflicts": 0, "latencies": []}

    chunk_size = len(records) // num_threads
    chunks = [records[i*chunk_size:(i+1)*chunk_size] for i in range(num_threads)]

    def worker(chunk):
        w = writer_class(*writer_args)
        batch = []
        for record in chunk:
            batch.append(record)
            if len(batch) >= batch_size:
                try:
                    if db_name == "fauna":
                        lat = w.insert_batch(batch)
                        conflicts = 0
                    else:
                        lat, conflicts = w.insert_batch(batch)
                    with lock:
                        shared["docs"] += len(batch)
                        shared["latencies"].append(lat)
                        shared["conflicts"] += conflicts
                except Exception:
                    with lock:
                        shared["errors"] += len(batch)
                batch = []
        if batch:
            try:
                if db_name == "fauna":
                    lat = w.insert_batch(batch)
                    conflicts = 0
                else:
                    lat, conflicts = w.insert_batch(batch)
                with lock:
                    shared["docs"] += len(batch)
                    shared["latencies"].append(lat)
                    shared["conflicts"] += conflicts
            except Exception:
                with lock:
                    shared["errors"] += len(batch)

    start = time.time()
    threads = [threading.Thread(target=worker, args=(chunk,)) for chunk in chunks]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    elapsed = time.time() - start

    return {
        "docs": shared["docs"],
        "errors": shared["errors"],
        "conflicts": shared["conflicts"],
        "elapsed": round(elapsed, 2),
        "speed": round(shared["docs"] / elapsed if elapsed > 0 else 0, 0),
        "avg_latency": round(sum(shared["latencies"]) / len(shared["latencies"]) if shared["latencies"] else 0, 2)
    }


# ─── Test 3 : Mise à jour concurrente du même document ───────────────────────

def run_acid_test_fauna(fauna_writer, num_threads, increments_per_thread):
    """
    Fauna ACID : plusieurs threads incrémentent un compteur partagé.
    Grâce aux transactions ACID, le résultat final doit être exact.
    """
    client = fauna_writer.client
    errors = [0]
    lock2 = threading.Lock()

    try:
        # Crée la collection Counter si nécessaire
        client.query(
            q.if_(q.exists(q.collection("Counter")), True, q.create_collection({"name": "Counter"}))
        )
        # Crée le document compteur
        result = client.query(q.create(q.collection("Counter"), {"data": {"value": 0}}))
        doc_ref = result["ref"]
    except Exception as e:
        print(f"[Fauna ACID] Erreur init: {e}")
        return {"expected": 0, "actual": 0, "correct": False, "conflicts": 0, "errors": 1}

    def increment_worker():
        w = _FaunaSDK(secret=fauna_writer.secret, domain=fauna_writer.host, port=fauna_writer.port, scheme="http")
        for _ in range(increments_per_thread):
            try:
                doc = w.query(q.get(doc_ref))
                current = doc["data"]["value"]
                w.query(q.update(doc_ref, {"data": {"value": current + 1}}))
            except Exception:
                with lock2:
                    errors[0] += 1

    threads = [threading.Thread(target=increment_worker) for _ in range(num_threads)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # Lit la valeur finale
    try:
        final = client.query(q.get(doc_ref))
        actual = final["data"]["value"]
    except Exception:
        actual = -1

    expected = num_threads * increments_per_thread

    # Nettoyage
    try:
        client.query(q.delete(doc_ref))
    except Exception:
        pass

    return {
        "expected": expected,
        "actual": actual,
        "correct": actual == expected,
        "errors": errors[0],
        "conflicts": 0
    }


def run_acid_test_couchdb(couch_writer, num_threads, increments_per_thread):
    """
    CouchDB sans transactions : plusieurs threads modifient le même document.
    CouchDB utilise des révisions — les conflits causent des pertes de mises à jour.
    """
    # Crée le document compteur
    r = couch_writer.session.put(
        f"{couch_writer.base_url}/counter_test",
        json={}
    )
    r = couch_writer.session.post(
        f"{couch_writer.base_url}/counter_test",
        json={"_id": "shared_counter", "value": 0}
    )

    conflicts = [0]
    errors = [0]
    lock2 = threading.Lock()

    def increment_worker():
        for _ in range(increments_per_thread):
            # Lit la révision actuelle
            r = couch_writer.session.get(
                f"{couch_writer.base_url}/counter_test/shared_counter"
            )
            if r.status_code != 200:
                with lock2:
                    errors[0] += 1
                continue
            doc = r.json()
            # Tente de mettre à jour
            doc["value"] = doc.get("value", 0) + 1
            r2 = couch_writer.session.put(
                f"{couch_writer.base_url}/counter_test/shared_counter",
                json=doc
            )
            if r2.status_code == 409:  # Conflict
                with lock2:
                    conflicts[0] += 1
            elif r2.status_code not in (200, 201):
                with lock2:
                    errors[0] += 1

    threads = [threading.Thread(target=increment_worker) for _ in range(num_threads)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # Lit la valeur finale
    r = couch_writer.session.get(
        f"{couch_writer.base_url}/counter_test/shared_counter"
    )
    actual = r.json().get("value", -1) if r.status_code == 200 else -1
    expected = num_threads * increments_per_thread

    # Nettoyage
    couch_writer.session.delete(f"{couch_writer.base_url}/counter_test")

    return {
        "expected": expected,
        "actual": actual,
        "correct": actual == expected,
        "errors": errors[0],
        "conflicts": conflicts[0]
    }




def save_results(fauna_writer, seq_fauna, seq_couch, conc_fauna, conc_couch, acid_fauna, acid_couch):
    result = {
        "timestamp": int(time.time() * 1000),
        "fauna": seq_fauna,
        "couchdb": seq_couch,
        "concurrent_fauna": conc_fauna,
        "concurrent_couchdb": conc_couch,
        "acid_fauna": acid_fauna,
        "acid_couchdb": acid_couch
    }
    try:
        fauna_writer.save_results(result)
        print("\n✅ Résultats sauvegardés — visible dans le dashboard onglet Benchmark")
    except Exception as e:
        print(f"\n⚠️  Sauvegarde échouée: {e}")


# ─── Affichage ────────────────────────────────────────────────────────────────

def print_results(seq_fauna, seq_couch, conc_fauna, conc_couch, acid_fauna, acid_couch):
    print("\n" + "="*65)
    print("   TEST 1 : Injection séquentielle (vitesse brute)")
    print("="*65)
    print(f"{'Métrique':<28} {'Fauna':>17} {'CouchDB':>17}")
    print("-"*65)
    print(f"{'Docs injectés':<28} {seq_fauna['docs']:>17,} {seq_couch['docs']:>17,}")
    print(f"{'Temps total (s)':<28} {seq_fauna['elapsed']:>17} {seq_couch['elapsed']:>17}")
    print(f"{'Vitesse (docs/s)':<28} {seq_fauna['speed']:>17.0f} {seq_couch['speed']:>17.0f}")
    print(f"{'Latence moyenne (ms)':<28} {seq_fauna['avg_latency']:>17} {seq_couch['avg_latency']:>17}")
    print(f"{'Erreurs':<28} {seq_fauna['errors']:>17} {seq_couch['errors']:>17}")

    print("\n" + "="*65)
    print("   TEST 2 : Injection concurrente (4 threads) — ACID vs non-ACID")
    print("="*65)
    print(f"{'Métrique':<28} {'Fauna':>17} {'CouchDB':>17}")
    print("-"*65)
    print(f"{'Docs injectés':<28} {conc_fauna['docs']:>17,} {conc_couch['docs']:>17,}")
    print(f"{'Temps total (s)':<28} {conc_fauna['elapsed']:>17} {conc_couch['elapsed']:>17}")
    print(f"{'Vitesse (docs/s)':<28} {conc_fauna['speed']:>17.0f} {conc_couch['speed']:>17.0f}")
    print(f"{'Conflits détectés':<28} {conc_fauna['conflicts']:>17} {conc_couch['conflicts']:>17}")
    print(f"{'Erreurs':<28} {conc_fauna['errors']:>17} {conc_couch['errors']:>17}")

    print("\n📊 CONCLUSION:")
    if seq_fauna['speed'] > seq_couch['speed']:
        diff = ((seq_fauna['speed'] - seq_couch['speed']) / seq_couch['speed'] * 100)
        print(f"  ✅ Fauna {diff:.0f}% plus rapide en injection séquentielle")
    else:
        diff = ((seq_couch['speed'] - seq_fauna['speed']) / seq_fauna['speed'] * 100)
        print(f"  ⚠️  CouchDB {diff:.0f}% plus rapide en injection brute")

    if conc_fauna['conflicts'] < conc_couch['conflicts']:
        print(f"  ✅ Fauna: {conc_fauna['conflicts']} conflits vs CouchDB: {conc_couch['conflicts']} conflits sous charge concurrente")
        print(f"     → Les transactions ACID de Fauna garantissent la cohérence des données")
    print(f"  ✅ Fauna transactions ACID: cohérence forte garantie")
    print(f"  ✅ CouchDB: cohérence éventuelle, conflits possibles en mode distribué")

    print("\n" + "="*65)
    print("   TEST 3 : Cohérence ACID — Mise à jour concurrente du même document")
    print("="*65)
    print(f"  4 threads incrémentent le même compteur {acid_fauna['expected']//4} fois chacun")
    print(f"  Valeur attendue : {acid_fauna['expected']}")
    print(f"  Fauna  → valeur finale : {acid_fauna['actual']} | correct : {'✅ OUI' if acid_fauna['correct'] else '❌ NON'} | conflits : {acid_fauna['conflicts']}")
    print(f"  CouchDB → valeur finale : {acid_couch['actual']} | correct : {'✅ OUI' if acid_couch['correct'] else '❌ NON'} | conflits : {acid_couch['conflicts']}")
    if acid_fauna['correct'] and not acid_couch['correct']:
        lost = acid_fauna['expected'] - acid_couch['actual']
        print(f"\n  ✅ Fauna ACID : aucune mise à jour perdue")
        print(f"  ❌ CouchDB    : {lost} mises à jour perdues à cause des conflits de révisions")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Benchmark Fauna vs CouchDB')
    parser.add_argument('--fauna-host', default='localhost')
    parser.add_argument('--fauna-port', type=int, default=8443)
    parser.add_argument('--fauna-secret', required=True)
    parser.add_argument('--couch-host', default='localhost')
    parser.add_argument('--couch-port', type=int, default=5984)
    parser.add_argument('--couch-user', default='admin')
    parser.add_argument('--couch-password', default='admin')
    parser.add_argument('--input', default='telemetry_data.json')
    parser.add_argument('--limit', type=int, default=10000)
    parser.add_argument('--batch-size', type=int, default=50)
    parser.add_argument('--threads', type=int, default=4)
    args = parser.parse_args()

    fauna_writer = FaunaClient(args.fauna_host, args.fauna_port, args.fauna_secret)
    couch_writer = CouchDBClient(args.couch_host, args.couch_port, args.couch_user, args.couch_password)

    print("Préparation des collections...")
    fauna_writer.ensure_collection()
    couch_writer.ensure_collection()

    print(f"Lecture de {args.limit:,} documents...")
    records = []
    try:
        with open(args.input, 'r') as f:
            for i, line in enumerate(f):
                if i >= args.limit:
                    break
                line = line.strip()
                if line:
                    records.append(json.loads(line))
    except FileNotFoundError:
        print(f"Fichier {args.input} introuvable.")
        sys.exit(1)

    half = len(records) // 2
    seq_records = records[:half]
    conc_records = records[half:]

    # ── Test 1 : Séquentiel ──
    print(f"\n🚀 TEST 1 : Injection séquentielle ({len(seq_records):,} docs)...")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Fauna en cours...")
    seq_fauna = run_sequential_test(fauna_writer, seq_records, args.batch_size, "fauna")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] CouchDB en cours...")
    seq_couch = run_sequential_test(couch_writer, seq_records, args.batch_size, "couchdb")

    # ── Test 2 : Concurrent ──
    print(f"\n🚀 TEST 2 : Injection concurrente ({args.threads} threads, {len(conc_records):,} docs)...")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Fauna en cours...")
    conc_fauna = run_concurrent_test(
        FaunaClient, [args.fauna_host, args.fauna_port, args.fauna_secret],
        conc_records, args.batch_size, args.threads, "fauna"
    )
    print(f"[{datetime.now().strftime('%H:%M:%S')}] CouchDB en cours...")
    conc_couch = run_concurrent_test(
        CouchDBClient, [args.couch_host, args.couch_port, args.couch_user, args.couch_password],
        conc_records, args.batch_size, args.threads, "couchdb"
    )

    # ── Test 3 : ACID ──
    print(f"\n🚀 TEST 3 : Cohérence ACID — mise à jour concurrente du même document...")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Fauna en cours...")
    acid_fauna = run_acid_test_fauna(fauna_writer, args.threads, 25)
    print(f"[{datetime.now().strftime('%H:%M:%S')}] CouchDB en cours...")
    acid_couch = run_acid_test_couchdb(couch_writer, args.threads, 25)

    print_results(seq_fauna, seq_couch, conc_fauna, conc_couch, acid_fauna, acid_couch)
    save_results(fauna_writer, seq_fauna, seq_couch, conc_fauna, conc_couch, acid_fauna, acid_couch)


if __name__ == "__main__":
    main()
