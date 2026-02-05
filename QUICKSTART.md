# 🚀 Quick Start - CSS Intelligence Platform

## Démarrage rapide en 3 étapes

### 1. Installer les dépendances (déjà fait ✅)

```bash
npm install
npm run build
```

### 2. Démarrer le serveur

```bash
npm run dev serve -- --url https://example.com --port 3000
```

⚠️ **Note**: Node.js 18+ requis pour Playwright. Actuellement Node 16 installé.

### 3. Ouvrir le dashboard

Ouvrez votre navigateur: **http://localhost:3000**

## 🎯 Utilisation du Dashboard

### Premier scan

1. **Entrez l'URL de base** dans le champ en haut
2. Cliquez sur **"▶️ Démarrer le scan"**
3. Observez la progression en temps réel
4. Consultez les résultats dans la table

### Activer le monitoring continu

1. Cochez **"Monitoring continu"**
2. Définissez l'intervalle (5 minutes par défaut)
3. Le système scannera automatiquement à intervalle régulier

### Gérer les erreurs

- **📋 Copier** - Copie les détails des erreurs dans le presse-papiers
- **✗ Exclure** - Exclut une URL du monitoring
- **✓ Inclure** - Ré-inclut une URL

### Interprétation des statuts

- 🟢 **Vert** - Aucune erreur (score 100)
- 🟠 **Orange** - 1-4 erreurs (score 50-99)
- 🔴 **Rouge** - 5+ erreurs (score < 50)
- ⚫ **Noir** - URL exclue

## 💡 Exemples

### Exemple 1: Scan simple

```bash
npm run dev serve -- --url https://example.com
```

### Exemple 2: Port personnalisé

```bash
npm run dev serve -- --url https://example.com --port 8080
```

### Exemple 3: Monitoring local

```bash
npm run dev serve -- --url http://localhost:3000 --port 3001
```

## 🔍 Que détecte l'outil?

1. **Variables CSS non résolues**
   - `var(--color-primary)` utilisé mais `--color-primary` non déclaré

2. **Variables CSS inutilisées**
   - `--spacing-lg: 32px;` déclaré mais jamais utilisé

3. **Variables dupliquées**
   - `--color-blue: #3498db;` et `--primary: #3498db;` (même valeur)

4. **Haute spécificité**
   - `#header nav ul li a.active` (trop spécifique)

5. **Erreurs de parsing**
   - Syntaxe CSS invalide

## 📊 Données stockées

Toutes les données sont sauvegardées dans:
- **css-audit-data.json** - Base de données locale
- **logs/** - Logs d'exécution

## 🆘 Problèmes courants

### Le scan ne démarre pas

- Vérifiez que l'URL est accessible
- Vérifiez les logs: `tail -f logs/combined.log`

### Pas de données affichées

- Lancez un scan manuel
- Rafraîchissez la page (F5)
- Vérifiez la console navigateur (F12)

### Node.js trop ancien

```bash
# Installer Node.js 18+ avec nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

## 🎓 Prochaines étapes

1. ✅ Scannez votre premier site
2. ✅ Activez le monitoring continu
3. ✅ Explorez l'historique des erreurs
4. ✅ Excluez les URLs non pertinentes
5. ✅ Copiez et corrigez les erreurs

## 📚 Documentation complète

Voir [README.md](./README.md) pour la documentation complète.

---

**Bon monitoring! 🎨**
