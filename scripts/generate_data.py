#!/usr/bin/env python3
"""
Génère un fichier JSON de données de télémétrie (~10GB)
Chaque PC lance ce script pour générer ses propres données
"""

import json
import time
import random
import argparse
import os
from datetime import datetime, timedelta

# Profils de comportement par heure (0-23h)
# Simule un vrai pattern : calme la nuit, chargé le jour
HOUR_LOAD_PROFILE = {
    0: 0.1, 1: 0.1, 2: 0.1, 3: 0.1, 4: 0.1, 5: 0.2,
    6: 0.3, 7: 0.5, 8: 0.7, 9: 0.9, 10: 0.95, 11: 1.0,
    12: 0.85, 13: 0.9, 14: 0.95, 15: 1.0, 16: 0.9, 17: 0.8,
    18: 0.6, 19: 0.5, 20: 0.4, 21: 0.3, 22: 0.2, 23: 0.1
}

# Types d'événements possibles avec leur probabilité
EVENTS = [
    ("normal", 0.75),
    ("high_load", 0.12),
    ("spike", 0.05),
    ("degraded", 0.05),
    ("recovery", 0.03)
]

def pick_event():
    r = random.random()
    cumul = 0
    for event, prob in EVENTS:
        cumul += prob
        if r < cumul:
            return event
    return "normal"

def generate_record(node, region, base_time, index):
    """Génère un enregistrement réaliste basé sur l'heure et un événement"""
    
    # Timestamp qui avance de 1 seconde à chaque record
    ts = base_time + index
    dt = datetime.fromtimestamp(ts)
    hour = dt.hour
    load = HOUR_LOAD_PROFILE[hour]
    
    event = pick_event()
    
    # Ajuste les métriques selon l'événement
    if event == "spike":
        load = min(1.0, load * 2.5)
    elif event == "high_load":
        load = min(1.0, load * 1.5)
    elif event == "degraded":
        load = min(1.0, load * 1.3)
    elif event == "recovery":
        load = max(0.1, load * 0.6)

    # CPU corrélé avec la charge + bruit
    cpu = round(load * 85 + random.uniform(-5, 10), 2)
    cpu = max(2.0, min(99.9, cpu))

    # Mémoire monte plus lentement que CPU
    memory = round(load * 70 + random.uniform(-3, 8), 2)
    memory = max(10.0, min(95.0, memory))

    # Latence augmente avec la charge
    latency = round(10 + load * 120 + random.uniform(-5, 20), 2)
    latency = max(1.0, latency)

    # Requêtes par seconde
    requests = int(load * 1000 + random.uniform(-50, 100))
    requests = max(0, requests)

    # Erreurs augmentent avec la charge et les événements dégradés
    error_rate = 0.01
    if event in ("degraded", "spike"):
        error_rate = 0.08
    elif event == "high_load":
        error_rate = 0.03
    errors = int(requests * error_rate)

    return {
        "timestamp": int(ts * 1000),  # ms
        "node": node,
        "region": region,
        "event": event,
        "cpu": cpu,
        "memory": memory,
        "latency_ms": latency,
        "requests_per_sec": requests,
        "errors": errors,
        "hour": hour
    }

def main():
    parser = argparse.ArgumentParser(description='Générateur de données télémétrie')
    parser.add_argument('--node', required=True, help='Nom du nœud (ex: PC2)')
    parser.add_argument('--region', required=True, help='Région (ex: Europe)')
    parser.add_argument('--output', default='telemetry_data.json', help='Fichier de sortie')
    parser.add_argument('--size-gb', type=float, default=10.0, help='Taille cible en GB (défaut: 10)')
    args = parser.parse_args()

    target_bytes = int(args.size_gb * 1024 * 1024 * 1024)
    
    # Commence 7 jours en arrière pour avoir des données historiques
    base_time = time.time() - (7 * 24 * 3600)

    print(f"Génération de {args.size_gb}GB de données pour {args.node} ({args.region})")
    print(f"Fichier de sortie: {args.output}")
    print(f"Estimation: ~{int(target_bytes / 250)} documents")
    print("Démarrage...")

    written_bytes = 0
    count = 0
    start = time.time()

    with open(args.output, 'w') as f:
        while written_bytes < target_bytes:
            record = generate_record(args.node, args.region, base_time, count)
            line = json.dumps(record) + '\n'
            f.write(line)
            written_bytes += len(line.encode('utf-8'))
            count += 1

            if count % 100000 == 0:
                elapsed = time.time() - start
                mb_written = written_bytes / (1024 * 1024)
                gb_written = written_bytes / (1024 * 1024 * 1024)
                speed = mb_written / elapsed
                remaining = (target_bytes - written_bytes) / (speed * 1024 * 1024)
                print(f"  {gb_written:.2f}GB / {args.size_gb}GB | "
                      f"{count:,} docs | "
                      f"{speed:.1f} MB/s | "
                      f"~{remaining:.0f}s restantes")

    elapsed = time.time() - start
    final_size = os.path.getsize(args.output) / (1024 * 1024 * 1024)
    print(f"\nTerminé! {count:,} documents générés")
    print(f"Taille finale: {final_size:.2f} GB")
    print(f"Durée: {elapsed:.0f}s")

if __name__ == "__main__":
    main()
