# Agent API Documentation

API endpoints pour permettre aux agents autonomes de lancer des scans CSS et récupérer les résultats de façon progressive.

## Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Endpoints](#endpoints)
- [Workflow typique](#workflow-typique)
- [Exemples](#exemples)

---

## Vue d'ensemble

L'API Agent permet aux scripts automatisés ou agents autonomes de:

1. **Lancer des scans** sur des URLs spécifiques (sans découverte automatique)
2. **Vérifier le statut** d'un scan en cours
3. **Récupérer les résultats** de façon progressive avec pagination

**Base URL**: `http://localhost:3000/api/agent`

---

## Endpoints

### 1. POST /api/agent/scan

Lance un scan CSS sur une liste d'URLs spécifiques.

**Request**:
```http
POST /api/agent/scan
Content-Type: application/json

{
  "urls": [
    "https://example.com",
    "https://example.com/about",
    "https://example.com/contact"
  ]
}
```

**Response (200 OK)**:
```json
{
  "scanId": "agent-1709123456789",
  "status": "started",
  "totalUrls": 3,
  "message": "Scan started. Use /api/agent/status to check progress."
}
```

**Errors**:
- `400 Bad Request`: URLs invalides ou tableau vide
- `409 Conflict`: Un scan est déjà en cours
- `500 Internal Server Error`: Erreur serveur

**Notes**:
- Le scan s'exécute de façon **asynchrone**
- La réponse est immédiate (ne bloque pas)
- Utiliser `/api/agent/status` pour suivre la progression

---

### 2. GET /api/agent/status

Vérifie si un scan est en cours d'exécution.

**Request**:
```http
GET /api/agent/status
```

**Response (200 OK)**:
```json
{
  "scanning": true,
  "lastScan": 1709123456789,
  "status": "running"
}
```

**Champs**:
- `scanning` (boolean): `true` si un scan est en cours
- `lastScan` (number|null): Timestamp du dernier scan complété
- `status` (string): `"running"` ou `"idle"`

---

### 3. GET /api/agent/results

Récupère les résultats d'analyse pour des URLs spécifiques avec pagination.

**Request**:
```http
GET /api/agent/results?urls=url1,url2,url3&offset=0&limit=10
```

**Query Parameters**:
- `urls` (required): Liste d'URLs séparées par des virgules
- `offset` (optional): Position de départ (défaut: 0)
- `limit` (optional): Nombre de résultats par page (défaut: 100)

**Response (200 OK)**:
```json
{
  "results": [
    {
      "url": "https://example.com",
      "status": "success",
      "healthScore": 85,
      "errorCount": 3,
      "errors": [
        {
          "id": "unresolved_--custom-color_1709123456789",
          "type": "UNRESOLVED_VARIABLE",
          "severity": "high",
          "message": "Variable --custom-color is used but not declared",
          "details": "CSS custom property --custom-color is referenced with var() but no declaration found",
          "suggestion": "Declare --custom-color in your CSS or check for typos"
        }
      ],
      "lastAnalyzed": 1709123456789
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 10,
    "total": 3,
    "hasMore": false,
    "returned": 3
  },
  "summary": {
    "totalUrls": 3,
    "totalErrors": 8,
    "averageHealthScore": 82
  }
}
```

**Errors**:
- `400 Bad Request`: Paramètre `urls` manquant
- `500 Internal Server Error`: Erreur serveur

---

## Workflow typique

### Scénario 1: Scan simple et récupération de résultats

```bash
# 1. Lancer le scan
curl -X POST http://localhost:3000/api/agent/scan \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://example.com",
      "https://example.com/about"
    ]
  }'

# 2. Attendre quelques secondes (le scan s'exécute)
sleep 10

# 3. Vérifier le statut
curl http://localhost:3000/api/agent/status

# 4. Récupérer les résultats
curl "http://localhost:3000/api/agent/results?urls=https://example.com,https://example.com/about"
```

---

### Scénario 2: Polling du statut et récupération progressive

```javascript
// Agent Node.js exemple
const axios = require('axios');

const API_BASE = 'http://localhost:3000/api/agent';

async function scanAndMonitor(urls) {
  // 1. Lancer le scan
  const scanResponse = await axios.post(`${API_BASE}/scan`, { urls });
  console.log(`Scan started: ${scanResponse.data.scanId}`);

  // 2. Polling du statut toutes les 5 secondes
  while (true) {
    const statusResponse = await axios.get(`${API_BASE}/status`);

    if (statusResponse.data.scanning) {
      console.log('Scan en cours...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log('Scan terminé !');
      break;
    }
  }

  // 3. Récupérer les résultats
  const urlsParam = urls.join(',');
  const resultsResponse = await axios.get(`${API_BASE}/results`, {
    params: { urls: urlsParam }
  });

  console.log(`Résultats: ${resultsResponse.data.results.length} URLs`);
  console.log(`Erreurs totales: ${resultsResponse.data.summary.totalErrors}`);

  return resultsResponse.data;
}

// Utilisation
const urlsToScan = [
  'https://example.com',
  'https://example.com/about',
  'https://example.com/contact'
];

scanAndMonitor(urlsToScan)
  .then(results => {
    // Traiter les résultats
    results.results.forEach(result => {
      console.log(`${result.url}: ${result.errorCount} erreurs`);
    });
  })
  .catch(err => console.error('Erreur:', err));
```

---

### Scénario 3: Récupération progressive avec pagination

```javascript
async function fetchAllResults(urls) {
  const allResults = [];
  let offset = 0;
  const limit = 10;
  let hasMore = true;

  const urlsParam = urls.join(',');

  while (hasMore) {
    const response = await axios.get(`${API_BASE}/results`, {
      params: { urls: urlsParam, offset, limit }
    });

    allResults.push(...response.data.results);

    hasMore = response.data.pagination.hasMore;
    offset += limit;

    console.log(`Récupéré ${allResults.length}/${response.data.pagination.total} URLs`);
  }

  return allResults;
}
```

---

## Exemples

### Exemple Python

```python
import requests
import time

API_BASE = "http://localhost:3000/api/agent"

def scan_urls(urls):
    # Lancer le scan
    response = requests.post(f"{API_BASE}/scan", json={"urls": urls})
    scan_data = response.json()
    print(f"Scan lancé: {scan_data['scanId']}")

    # Attendre la fin du scan
    while True:
        status = requests.get(f"{API_BASE}/status").json()
        if not status['scanning']:
            break
        print("Scan en cours...")
        time.sleep(5)

    # Récupérer les résultats
    urls_param = ",".join(urls)
    results = requests.get(f"{API_BASE}/results", params={"urls": urls_param})
    return results.json()

# Utilisation
urls_to_scan = [
    "https://example.com",
    "https://example.com/about"
]

results = scan_urls(urls_to_scan)
print(f"Erreurs totales: {results['summary']['totalErrors']}")
```

---

### Exemple avec WebSocket (temps réel)

Si vous voulez des mises à jour en temps réel pendant le scan, utilisez Socket.IO:

```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3000');

// Écouter les événements de scan
socket.on('scan:started', () => {
  console.log('Scan démarré');
});

socket.on('scan:progress', (data) => {
  console.log(`Progression: ${data.current}/${data.total} - ${data.currentUrl}`);
});

socket.on('page:analyzed', (data) => {
  console.log(`${data.url}: ${data.errorCount} erreurs, score: ${data.healthScore}`);
});

socket.on('scan:completed', (data) => {
  console.log(`Scan terminé: ${data.urlsScanned} URLs, ${data.totalErrors} erreurs`);
});

// Lancer le scan via API HTTP
axios.post(`${API_BASE}/scan`, { urls: [...] });
```

---

## Structure des erreurs

Chaque URL analysée contient un tableau d'erreurs avec cette structure:

```typescript
{
  id: string;              // ID unique de l'erreur
  type: string;            // Type: UNRESOLVED_VARIABLE, UNUSED_VARIABLE, etc.
  severity: string;        // critical, high, medium, low
  message: string;         // Message court
  details: string;         // Description détaillée
  suggestion?: string;     // Suggestion de correction
  location?: {             // Position dans le code (optionnel)
    file?: string;
    line?: number;
    column?: number;
    selector?: string;
  };
}
```

**Types d'erreurs**:
- `UNRESOLVED_VARIABLE`: Variable CSS utilisée mais non déclarée
- `UNUSED_VARIABLE`: Variable CSS déclarée mais jamais utilisée
- `DUPLICATE_VARIABLE`: Variables avec la même valeur
- `HIGH_SPECIFICITY`: Sélecteur avec spécificité trop élevée
- `PARSE_ERROR`: Erreur de syntaxe CSS

**Niveaux de sévérité**:
- `critical`: Erreur bloquante (ex: syntaxe invalide)
- `high`: Problème majeur (ex: variable manquante)
- `medium`: Problème modéré (ex: spécificité élevée)
- `low`: Amélioration suggérée (ex: variable inutilisée)

---

## Notes importantes

1. **Un seul scan à la fois**: Le système n'autorise qu'un scan simultané. Si vous appelez `/api/agent/scan` pendant qu'un scan est en cours, vous recevrez une erreur 409.

2. **Scan asynchrone**: Le scan s'exécute en arrière-plan. La réponse de `/api/agent/scan` est immédiate.

3. **Configuration DNS**: Le scan utilise la configuration DNS stockée dans la base de données (`hostResolverRules` et `customBrowserArgs`).

4. **URLs exclues**: Les URLs marquées comme "exclues" dans l'interface web sont automatiquement ignorées.

5. **Timeout**: Chaque page a un timeout de 60 secondes (configurable dans `src/core/config.ts`).

---

## Support

Pour plus d'informations, consultez:
- [README principal](../README.md)
- [Configuration](../src/core/config.ts)
- [Types TypeScript](../src/core/types.ts)
