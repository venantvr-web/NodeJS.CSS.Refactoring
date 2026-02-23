# 🎨 CSS Intelligence Platform

Plateforme de monitoring et analyse CSS en temps réel avec dashboard interactif Vue.js.

## ✨ Fonctionnalités

- **Crawling automatique** - Analyse toutes les pages d'un domaine
- **Détection d'erreurs CSS** en temps réel:
  - Variables CSS non résolues
  - Variables CSS inutilisées
  - Variables dupliquées
  - Sélecteurs haute spécificité
  - Problèmes de parsing CSS
- **Dashboard interactif** avec Vue.js
- **Monitoring continu** avec intervalle configurable
- **Table des URLs** avec:
  - Statut coloré (🟢 vert, 🟠 orange, 🔴 rouge)
  - Nombre d'erreurs
  - Score de santé (0-100)
  - Bouton "Copier" pour exporter les erreurs
  - Possibilité d'exclure des URLs
- **WebSocket** pour mises à jour en temps réel
- **Historisation** des scans
- **Statistiques** globales
- **API Agent** pour scans autonomes et récupération progressive de résultats

## 📋 Prérequis

⚠️ **IMPORTANT**: Node.js 18+ est requis (actuellement Node.js 16 installé)

```bash
# Vérifier la version Node.js
node --version

# Si < 18, installer Node.js 18+ via nvm ou directement
```

## 🚀 Installation

```bash
# Installer les dépendances
npm install

# Installer les navigateurs Playwright (requiert Node 18+)
npx playwright install chromium

# Compiler le projet TypeScript
npm run build
```

## 💻 Utilisation

### Démarrer le serveur dashboard

```bash
# Méthode 1: Avec npm dev (recommandé pour développement)
npm run dev serve --url https://example.com

# Méthode 2: Après compilation
node dist/cli.js serve --url https://example.com --port 3000
```

### Options CLI

```bash
css-audit serve [options]

Options:
  -p, --port <port>    Port du serveur (défaut: 3000)
  -u, --url <url>      URL de base à monitorer
  -h, --help           Afficher l'aide
```

## 🌐 Dashboard

Une fois le serveur démarré, ouvrez:

```
http://localhost:3000
```

### Interface Dashboard

1. **Contrôles principaux**:
   - Champ URL de base
   - Bouton "Démarrer le scan"
   - Checkbox "Monitoring continu"
   - Intervalle de scan configurable (en minutes)

2. **Statistiques**:
   - URLs totales
   - URLs actives
   - Erreurs totales
   - Score santé moyen

3. **Table des URLs**:
   - **Status**: Icône colorée (🟢🟠🔴⚫)
   - **URL**: Chemin complet
   - **Erreurs**: Nombre avec badge coloré
   - **Score**: Note de santé (0-100)
   - **Actions**:
     - 📋 **Copier**: Copie les détails des erreurs
     - ✗ **Exclure**: Exclut l'URL du monitoring
     - ✓ **Inclure**: Ré-inclut une URL exclue

## 📊 Types d'erreurs détectées

| Type | Sévérité | Description |
|------|----------|-------------|
| `unresolved_variable` | HIGH | Variable CSS utilisée mais non déclarée |
| `unused_variable` | LOW | Variable CSS déclarée mais jamais utilisée |
| `duplicate_variable` | MEDIUM | Plusieurs variables avec la même valeur |
| `high_specificity` | MEDIUM | Sélecteur trop spécifique |
| `parse_error` | CRITICAL | Erreur de syntaxe CSS |

## 🔧 Configuration

### Fichier de configuration

Le projet utilise une base de données JSON (`css-audit-data.json`) qui stocke:
- URLs crawlées
- Configuration du monitoring
- Historique des scans
- URLs exclues

### Configuration par défaut

```javascript
{
  baseUrl: '',
  maxPages: 100,
  scanInterval: 5, // minutes
  crawler: {
    timeout: 30000,
    viewport: { width: 1920, height: 1080 }
  },
  analyzers: {
    cssVariables: true,
    selectors: true,
    accessibility: true,
    specificity: true
  }
}
```

## 📁 Structure du projet

```
/var/www/NodeJS.CSS.Refactoring/
├── src/
│   ├── core/
│   │   ├── types.ts           # Définitions TypeScript
│   │   ├── database.ts        # Couche base de données (lowdb)
│   │   ├── logger.ts          # Logger Winston
│   │   ├── config.ts          # Configuration
│   │   └── orchestrator.ts    # Orchestration des scans
│   ├── crawler/
│   │   ├── page-crawler.ts    # Crawling Playwright
│   │   └── css-extractor.ts   # Extraction CSS
│   ├── analyzers/
│   │   └── css-analyzer.ts    # Analyse CSS & détection erreurs
│   ├── server/
│   │   └── index.ts           # Serveur Express + WebSocket
│   ├── cli.ts                 # Interface CLI
│   └── index.ts               # Export principal
├── public/
│   └── index.html             # Dashboard Vue.js
├── dist/                      # Fichiers compilés
├── logs/                      # Logs d'exécution
├── css-audit-data.json        # Base de données
└── package.json
```

## 🔌 API REST

Le serveur expose une API REST:

### Endpoints standards

- `GET /api/urls` - Liste toutes les URLs
- `GET /api/stats` - Statistiques globales
- `GET /api/config` - Configuration actuelle
- `POST /api/config` - Mettre à jour la config
- `POST /api/scan/start` - Démarrer un scan
- `POST /api/monitoring/start` - Démarrer le monitoring
- `POST /api/monitoring/stop` - Arrêter le monitoring
- `POST /api/url/exclude` - Exclure/inclure une URL
- `GET /api/history` - Historique des scans

### API Agent (pour scripts autonomes)

Endpoints spécialisés pour permettre à des agents autonomes de scanner des URLs spécifiques:

- `POST /api/agent/scan` - Lancer un scan sur des URLs spécifiques
  ```json
  {
    "urls": ["https://example.com", "https://example.com/about"]
  }
  ```

- `GET /api/agent/status` - Vérifier si un scan est en cours
  ```json
  {
    "scanning": true,
    "lastScan": 1709123456789,
    "status": "running"
  }
  ```

- `GET /api/agent/results?urls=url1,url2&offset=0&limit=100` - Récupérer les résultats avec pagination
  ```json
  {
    "results": [...],
    "pagination": { "offset": 0, "limit": 100, "total": 2, "hasMore": false },
    "summary": { "totalUrls": 2, "totalErrors": 5, "averageHealthScore": 85 }
  }
  ```

**📖 Documentation complète**: [docs/AGENT_API.md](docs/AGENT_API.md)

**🧪 Exemples**:
- Script Node.js: [examples/agent-api-test.js](examples/agent-api-test.js)
- Script curl: [examples/agent-api-curl.sh](examples/agent-api-curl.sh)

### WebSocket Events

- `scan:started` - Scan démarré
- `scan:progress` - Progression (current, total, currentUrl)
- `scan:completed` - Scan terminé
- `page:analyzed` - Page analysée
- `url:excluded` - URL exclue/inclue
- `urls:update` - Liste URLs mise à jour
- `config:update` - Config mise à jour

## 🧪 Développement

```bash
# Mode développement avec rechargement auto
npm run dev serve --url https://example.com

# Linter
npm run lint
npm run lint:fix

# Format
npm run format

# Tests (à implémenter)
npm test
```

## 🐛 Troubleshooting

### Erreur: Node.js version

```
Error: Playwright requires Node.js 18 or higher
```

**Solution**: Installer Node.js 18+ via [nvm](https://github.com/nvm-sh/nvm) ou [nodejs.org](https://nodejs.org/)

### Port déjà utilisé

```
Error: Port 3000 already in use
```

**Solution**: Utiliser un port différent avec `--port 3001`

### Erreur de crawling

Si le crawling échoue:
1. Vérifier que l'URL est accessible
2. Vérifier les logs dans `logs/error.log`
3. Augmenter le timeout dans la config

## 📝 TODO / Améliorations futures

- [ ] Découverte automatique des URLs (sitemap.xml, liens)
- [ ] Analyse d'accessibilité (contraste couleurs, focus states)
- [ ] Support CSS-in-JS (styled-components, emotion)
- [ ] Export des rapports (PDF, CSV)
- [ ] Graphiques de tendances historiques
- [ ] Intégration CI/CD (GitHub Actions)
- [ ] Notifications (email, Slack)
- [ ] Mode comparaison (avant/après)
- [ ] Tests unitaires et E2E

## 📄 Licence

MIT

## 👨‍💻 Auteur

Développé avec Claude Code & Sonnet 4.5

## Stack

[![Stack](https://skillicons.dev/icons?i=nodejs,ts,vue,express,css&theme=dark)](https://skillicons.dev)
