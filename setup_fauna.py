#!/usr/bin/env python3
import requests
import json

# Configuration
FAUNA_URL = "http://localhost:8443"

def create_database_and_key():
    """Crée la database tp_bigdata et génère une clé"""
    
    # D'abord, créer la database
    create_db_query = """
    CreateDatabase({ name: "tp_bigdata" })
    """
    
    try:
        response = requests.post(
            f"{FAUNA_URL}/query",
            headers={"Content-Type": "application/json"},
            json={"query": create_db_query}
        )
        
        if response.status_code == 200:
            print("✅ Database 'tp_bigdata' créée avec succès!")
            db_result = response.json()
            print(f"Résultat: {db_result}")
        else:
            print(f"❌ Erreur création database: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Erreur connexion: {e}")
        return None

def create_server_key():
    """Crée une clé serveur pour la database tp_bigdata"""
    
    create_key_query = """
    CreateKey({ 
        database: Database("tp_bigdata"), 
        role: "server" 
    })
    """
    
    try:
        response = requests.post(
            f"{FAUNA_URL}/query",
            headers={"Content-Type": "application/json"},
            json={"query": create_key_query}
        )
        
        if response.status_code == 200:
            print("✅ Clé serveur créée avec succès!")
            key_result = response.json()
            
            if 'secret' in str(key_result):
                # Extraire la clé secrète
                import re
                secret_match = re.search(r'fn[a-zA-Z0-9]+', str(key_result))
                if secret_match:
                    secret_key = secret_match.group(0)
                    print(f"\n🔑 VOTRE CLÉ SECRÈTE:")
                    print(f"   {secret_key}")
                    print(f"\n📋 Copiez cette clé et collez-la dans votre dashboard React!")
                    print(f"   URL du dashboard: http://localhost:5173")
                    return secret_key
                    
            print(f"Résultat: {key_result}")
        else:
            print(f"❌ Erreur création clé: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Erreur connexion: {e}")
        
    return None

if __name__ == "__main__":
    print("🚀 Configuration de Fauna pour le TP Big Data")
    print("=" * 50)
    
    print("\n1️⃣ Création de la database 'tp_bigdata'...")
    create_database_and_key()
    
    print("\n2️⃣ Création de la clé serveur...")
    secret_key = create_server_key()
    
    if secret_key:
        print(f"\n✅ Configuration terminée!")
        print(f"📝 Prochaine étape: Allez sur http://localhost:5173 et connectez-vous avec votre clé")
    else:
        print(f"\n❌ Échec de la configuration. Vérifiez que Fauna tourne sur http://localhost:8443")
