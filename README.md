# Fauna Big Data Dashboard

Interface de monitoring en temps réel pour le TP de Master sur l'architecture Big Data avec Fauna.

## Architecture du TP

### Machine 1 (Cerveau) - PC Principal
- **Rôle**: Héberge Fauna (Docker) + Dashboard React
- **Composants**: 
  - Fauna Database sur port 8443
  - Interface web de monitoring
  - Affichage des résultats en temps réel

### Machines 2-5 (Générateurs) - PC Clients
- **Rôle**: Simulent des centres de données régionaux
- **Composants**: Scripts Python d'injection massive
- **Régions**: Europe, Afrique, Asie, Amérique

## Installation et Démarrage

### Prérequis
- Docker installé
- Node.js 18+ 
- Python 3.8+

### Machine 1 - Dashboard

#### 1. Installer les dépendances
```bash
npm install
```

#### 2. Démarrer Fauna avec Docker

Lance le container Fauna en arrière-plan. Le flag `-p 8443:8443` expose le port de la base de données sur ta machine.
```bash
docker run --name fauna -p 8443:8443 -d fauna/faunadb
```

Vérifie que le container tourne bien (STATUS doit être `healthy`) :
```bash
docker ps
```

#### 3. Créer la database et générer la clé secrète

Le container Fauna n'inclut pas de shell interactif (`fauna-shell` n'est pas disponible dans cette image). On passe donc par l'API HTTP directement.

Fauna en local accepte le mot `secret` comme clé root par défaut — c'est uniquement pour l'administration initiale en local.

**Crée la database `tp_bigdata` :**
```powershell
Invoke-RestMethod -Uri "http://localhost:8443/query/1" -Method POST -Headers @{ "Authorization" = "Bearer secret"; "Content-Type" = "application/json" } -Body '{"query": "Database.create({ name: \"tp_bigdata\" })"}'
```

**Crée une clé secrète de type `server` pour cette database :**
```powershell
Invoke-RestMethod -Uri "http://localhost:8443/query/1" -Method POST -Headers @{ "Authorization" = "Bearer secret"; "Content-Type" = "application/json" } -Body '{"query": "Key.create({ role: \"server\", database: \"tp_bigdata\" })"}'
```

Dans la réponse, copie la valeur du champ `secret` (commence par `fnA...`). Elle ne s'affiche qu'une seule fois.

> Sur Linux/Mac, remplace `Invoke-RestMethod` par `curl` :
> ```bash
> curl -X POST http://localhost:8443/query/1 \
>   -H "Authorization: Bearer secret" \
>   -H "Content-Type: application/json" \
>   -d '{"query": "Key.create({ role: \"server\", database: \"tp_bigdata\" })"}'
> ```

#### 4. Démarrer le dashboard
```bash
npm run dev
```

#### 5. Se connecter
- Ouvre `http://localhost:5173`
- Colle ta clé secrète (`fnA...`) dans le champ Secret Key
- Domaine : `localhost`
- Port : `8443`
- Clique sur "Se connecter" — le dashboard s'affiche

### Machines 2-5 - Scripts d'injection

1. **Installer Python requirements**:
```bash
pip install requests
```

2. **Lancer l'injection**:

**Mode normal (300 secondes)**:
```bash
python scripts/inject_data.py \
  --host <IP_PC1> \
  --port 8443 \
  --secret <VOTRE_SECRET> \
  --node "PC2" \
  --region "Europe" \
  --duration 300 \
  --batch-size 10 \
  --delay 1.0
```

**Mode stress test**:
```bash
python scripts/inject_data.py \
  --host <IP_PC1> \
  --port 8443 \
  --secret <VOTRE_SECRET> \
  --node "PC3" \
  --region "Afrique" \
  --stress \
  --threads 4 \
  --duration 60
```

## Fonctionnalités du Dashboard

### 1. Compteur Global
- Affiche le nombre total de documents en temps réel
- Vitesse d'injection par seconde
- Animation lors de l'augmentation

### 2. Répartition par Machine
- Graphique en barres du volume par machine
- Diagramme circulaire des pourcentages
- Statistiques détaillées par noud

### 3. Latence en Temps Réel
- Graphique linéaire de la latence
- Moyenne et maximum
- Performance par machine

## Flux de Travail pour la Présentation

1. **Préparation**:
   - Démarrer Fauna sur PC1
   - Lancer le dashboard
   - Vérifier la connexion

2. **Démonstration**:
   - Compteur à 0
   - Lancer simultanément les 4 scripts
   - Observer la croissance en temps réel

3. **Test de Haute Disponibilité**:
   - Arrêter brutalement PC3
   - Montrer que les autres machines continuent
   - Prouver la résilience du système

## Configuration des Scripts

### Paramètres disponibles:
- `--host`: IP du serveur Fauna (défaut: localhost)
- `--port`: Port Fauna (défaut: 8443)
- `--secret`: Clé secrète Fauna (obligatoire)
- `--node`: Identifiant de la machine (obligatoire)
- `--region`: Nom de la région (obligatoire)
- `--duration`: Durée en secondes (défaut: 300)
- `--batch-size`: Taille des lots (défaut: 10)
- `--delay`: Délai entre lots (défaut: 1.0s)
- `--stress`: Mode stress test
- `--threads`: Nombre de threads pour stress (défaut: 4)
- `--setup`: Configurer la base de données

### Exemples d'utilisation:

**PC2 - Europe**:
```bash
python scripts/inject_data.py \
  --host 192.168.1.100 \
  --secret fnA... \
  --node "PC2-Europe" \
  --region "Europe" \
  --duration 300
```

**PC3 - Afrique**:
```bash
python scripts/inject_data.py \
  --host 192.168.1.100 \
  --secret fnA... \
  --node "PC3-Afrique" \
  --region "Afrique" \
  --duration 300
```

## Structure des Données

Chaque document de télémétrie contient:
```json
{
  "timestamp": 1234567890000,
  "node": "PC2-Europe",
  "region": "Europe", 
  "latency": 45.2,
  "cpu": 67.8,
  "memory": 54.3,
  "network": 234.5
}
```

## Performance Attendue

- **Injection normale**: ~10-50 docs/sec par machine
- **Stress test**: ~100-500 docs/sec avec multi-threading
- **Latence**: 10-150ms selon la charge
- **Scalabilité**: Supporte des millions de documents

## Dépannage

### Problèmes courants:
1. **Connexion refusée**: Vérifiez que Fauna tourne sur le bon port
2. **Secret invalide**: Générez une nouvelle clé depuis Fauna
3. **Performance faible**: Vérifiez la connexion réseau entre machines
4. **Dashboard vide**: Attendez quelques secondes après le lancement des scripts

### Logs et monitoring:
- Les scripts affichent les statistiques en temps réel
- Le dashboard montre les métriques de performance
- Erreurs détaillées dans la console

## Technologies Utilisées

- **Frontend**: React 19 + TypeScript + Vite
- **Charts**: Recharts
- **Icons**: Lucide React
- **Database**: FaunaDB
- **Backend**: Python 3 + Requests
- **Container**: Docker
