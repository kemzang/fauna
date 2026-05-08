# 🚀 Procédure de démarrage complète

## Étape 1 : Démarrer les conteneurs

```powershell
# Démarrer Fauna et CouchDB
docker-compose up -d

# Vérifier que les conteneurs sont en cours d'exécution
docker ps --filter "name=fauna" --filter "name=couchdb"

# Attendre que Fauna soit "healthy" (environ 30 secondes)
docker ps --filter "name=fauna-node1"
```

**Attendez que le STATUS affiche `(healthy)` avant de continuer !**

---

## Étape 2 : Créer la base de données et générer la clé secrète

### Option A : Via Python (RECOMMANDÉ)

```powershell
# Utiliser le script setup_fauna.py
python setup_fauna.py
```

Ce script va :
1. Créer la base de données `tp_bigdata`
2. Générer une clé secrète
3. Afficher la clé à copier

### Option B : Via PowerShell (si Python ne fonctionne pas)

```powershell
# 1. Créer la base de données
$createDb = @{
    Uri = "http://localhost:8443/query/1"
    Method = "POST"
    Headers = @{
        "Authorization" = "Bearer secret"
        "Content-Type" = "application/json"
    }
    Body = '{"query": "Database.create({ name: \"tp_bigdata\" })"}'
} | ConvertTo-Json -Depth 10

Invoke-RestMethod @createDb

# 2. Créer une clé secrète
$createKey = @{
    Uri = "http://localhost:8443/query/1"
    Method = "POST"
    Headers = @{
        "Authorization" = "Bearer secret"
        "Content-Type" = "application/json"
    }
    Body = '{"query": "Key.create({ role: \"server\", database: Database.byName(\"tp_bigdata\") })"}'
} | ConvertTo-Json -Depth 10

$response = Invoke-RestMethod @createKey
$secret = $response.data.secret
Write-Host "Clé secrète générée : $secret"
```

**⚠️ IMPORTANT : Copiez la clé secrète affichée !**

---

## Étape 3 : Démarrer le dashboard

```powershell
# Dans le dossier du projet
npm run dev
```

Le dashboard sera accessible sur : **http://localhost:5173**

---

## Étape 4 : Générer les données de test

```powershell
# Générer 10,000 documents de télémétrie
python scripts/generate_data.py --output scripts/telemetry_data.json --count 10000
```

---

## Étape 5 : Lancer le benchmark

```powershell
# Remplacez YOUR_SECRET_KEY par la clé générée à l'étape 2
python scripts/benchmark.py --fauna-secret YOUR_SECRET_KEY --input scripts/telemetry_data.json --limit 10000
```

**Exemple :**
```powershell
python scripts/benchmark.py --fauna-secret fnAGbeYnI8ACAFgOHNwZKQVfTklCTUwIGl7m2Jtp --input scripts/telemetry_data.json --limit 10000
```

---

## 📊 Résultats attendus

Le benchmark va :
1. **Test 1** : Injection séquentielle (vitesse brute)
   - Mesure la vitesse d'écriture de Fauna vs CouchDB
   
2. **Test 2** : Injection concurrente (4 threads)
   - Montre les conflits CouchDB vs transactions ACID de Fauna
   
3. **Test 3** : Cohérence ACID
   - 4 threads modifient le même compteur simultanément
   - Fauna : valeur finale correcte (ACID)
   - CouchDB : mises à jour perdues (conflits de révisions)

Les résultats seront :
- Affichés dans le terminal
- Sauvegardés dans Fauna
- Visibles dans l'onglet **Benchmark** du dashboard

---

## 🔧 Dépannage

### Conteneur Fauna crashé (exit code 137)
```powershell
# Arrêter les conteneurs gourmands en RAM
docker stop flink rabbitmq kafka

# Redémarrer Fauna
docker-compose restart fauna-node1
```

### Erreur "connexion fermée"
- Vérifiez que Fauna est `(healthy)` : `docker ps`
- Attendez 30 secondes après le démarrage
- Vérifiez les logs : `docker logs fauna-node1`

### Page blanche du dashboard
- Utilisez le mode navigation privée (évite les extensions)
- Vérifiez la console du navigateur (F12)
- Vérifiez que `npm run dev` est en cours d'exécution

---

## 🌐 Injection depuis d'autres PC

Sur les autres PC du réseau :

```bash
# Remplacez 192.168.88.219 par l'IP de votre PC principal
python scripts/inject_data.py \
  --fauna-host 192.168.88.219 \
  --fauna-secret YOUR_SECRET_KEY \
  --couch-host 192.168.88.219 \
  --count 1000 \
  --rate 10
```

Cela va :
- Injecter des données dans Fauna ET CouchDB simultanément
- Afficher les stats en temps réel
- Permettre de voir la comparaison live dans l'onglet **Comparaison Live** du dashboard
