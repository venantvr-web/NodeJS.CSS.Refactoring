.PHONY: help install build start stop restart clean logs status test node18 dev

# Variables
PORT ?= 3000
URL ?= https://example.com

# Couleurs pour les messages
GREEN  := \033[0;32m
YELLOW := \033[0;33m
RED    := \033[0;31m
NC     := \033[0m # No Color

help: ## Affiche l'aide
	@echo "$(GREEN)CSS Intelligence Platform - Makefile Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Variables d'environnement:$(NC)"
	@echo "  PORT=$(PORT) - Port du serveur"
	@echo "  URL=$(URL) - URL de base à analyser"
	@echo ""
	@echo "$(YELLOW)Exemples:$(NC)"
	@echo "  make start"
	@echo "  make start PORT=8080 URL=https://example.com"
	@echo "  make logs"

install: ## Installe toutes les dépendances
	@echo "$(GREEN)Installation des dépendances...$(NC)"
	npm install
	@echo "$(GREEN)✓ Dépendances installées$(NC)"

build: ## Compile le projet TypeScript
	@echo "$(GREEN)Compilation TypeScript...$(NC)"
	npm run build
	@echo "$(GREEN)✓ Projet compilé dans dist/$(NC)"

start: build ## Démarre le serveur (port 3000 par défaut)
	@echo "$(GREEN)Démarrage du serveur sur le port $(PORT)...$(NC)"
	@echo "$(YELLOW)URL de base: $(URL)$(NC)"
	npm run dev serve -- --port $(PORT) --url "$(URL)" &
	@sleep 3
	@echo "$(GREEN)✓ Serveur démarré: http://localhost:$(PORT)$(NC)"

stop: ## Arrête le serveur
	@echo "$(YELLOW)Arrêt du serveur...$(NC)"
	@pkill -f "tsx src/cli.ts serve" || pkill -f "node dist/cli.js serve" || echo "Aucun serveur en cours"
	@sleep 1
	@echo "$(GREEN)✓ Serveur arrêté$(NC)"

restart: ## Redémarre le serveur
	-@$(MAKE) stop
	@echo "$(YELLOW)Réinitialisation de la base de données...$(NC)"
	@rm -f css-audit-data.json
	@echo "$(GREEN)✓ Base de données réinitialisée$(NC)"
	@$(MAKE) start

dev: ## Lance en mode développement avec rechargement auto
	@echo "$(GREEN)Mode développement (port $(PORT))...$(NC)"
	npm run dev serve -- --port $(PORT) --url "$(URL)"

status: ## Vérifie si le serveur est en cours d'exécution
	@echo "$(YELLOW)Statut du serveur:$(NC)"
	@ps aux | grep -E "tsx src/cli.ts|node.*dist/cli.js" | grep -v grep || echo "$(RED)✗ Serveur arrêté$(NC)"
	@curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:$(PORT) 2>/dev/null || echo "$(RED)✗ Serveur non accessible$(NC)"

logs: ## Affiche les logs en temps réel
	@echo "$(YELLOW)Logs (Ctrl+C pour quitter):$(NC)"
	@tail -f logs/combined.log 2>/dev/null || echo "$(RED)Aucun log disponible$(NC)"

logs-errors: ## Affiche les logs d'erreurs
	@echo "$(YELLOW)Logs d'erreurs:$(NC)"
	@tail -50 logs/error.log 2>/dev/null || echo "$(GREEN)Aucune erreur$(NC)"

clean: ## Nettoie les fichiers générés
	@echo "$(YELLOW)Nettoyage...$(NC)"
	rm -rf dist/
	rm -rf logs/
	rm -rf har/
	rm -f css-audit-data.json
	rm -rf node_modules/.cache
	@echo "$(GREEN)✓ Nettoyage effectué$(NC)"

clean-all: clean ## Nettoie tout y compris node_modules
	@echo "$(YELLOW)Nettoyage complet...$(NC)"
	rm -rf node_modules/
	@echo "$(GREEN)✓ Nettoyage complet effectué$(NC)"

test: ## Lance les tests (à implémenter)
	@echo "$(YELLOW)Lancement des tests...$(NC)"
	npm test

lint: ## Vérifie le code avec ESLint
	@echo "$(YELLOW)Vérification du code...$(NC)"
	npm run lint

lint-fix: ## Corrige automatiquement les erreurs ESLint
	@echo "$(YELLOW)Correction automatique...$(NC)"
	npm run lint:fix

format: ## Formate le code avec Prettier
	@echo "$(YELLOW)Formatage du code...$(NC)"
	npm run format

type-check: ## Vérifie les types TypeScript
	@echo "$(YELLOW)Vérification des types...$(NC)"
	npm run type-check

node-version: ## Affiche la version de Node.js
	@echo "$(YELLOW)Version de Node.js:$(NC)"
	@node --version

node18: ## Guide pour installer Node.js 18+
	@echo "$(GREEN)Installation de Node.js 18+ avec nvm:$(NC)"
	@echo ""
	@echo "$(YELLOW)1. Installer nvm (si pas déjà installé):$(NC)"
	@echo "   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
	@echo ""
	@echo "$(YELLOW)2. Recharger le shell:$(NC)"
	@echo "   source ~/.bashrc  # ou ~/.zshrc"
	@echo ""
	@echo "$(YELLOW)3. Installer Node.js 18:$(NC)"
	@echo "   nvm install 18"
	@echo ""
	@echo "$(YELLOW)4. Utiliser Node.js 18:$(NC)"
	@echo "   nvm use 18"
	@echo ""
	@echo "$(YELLOW)5. Définir comme version par défaut:$(NC)"
	@echo "   nvm alias default 18"
	@echo ""
	@echo "$(YELLOW)6. Vérifier:$(NC)"
	@echo "   node --version  # Devrait afficher v18.x.x"
	@echo ""
	@echo "$(YELLOW)7. Installer Playwright:$(NC)"
	@echo "   npx playwright install chromium"
	@echo ""

playwright: ## Installe les navigateurs Playwright
	@echo "$(GREEN)Installation des navigateurs Playwright...$(NC)"
	npx playwright install chromium
	@echo "$(GREEN)✓ Navigateurs installés$(NC)"

db-reset: ## Réinitialise la base de données
	@echo "$(YELLOW)Réinitialisation de la base de données...$(NC)"
	rm -f css-audit-data.json
	@echo "$(GREEN)✓ Base de données réinitialisée$(NC)"

db-show: ## Affiche le contenu de la base de données
	@echo "$(YELLOW)Contenu de la base de données:$(NC)"
	@cat css-audit-data.json 2>/dev/null | python3 -m json.tool || echo "$(RED)Base de données vide ou invalide$(NC)"

db-backup: ## Sauvegarde la base de données
	@echo "$(YELLOW)Sauvegarde de la base de données...$(NC)"
	@cp css-audit-data.json css-audit-data.backup.$$(date +%Y%m%d_%H%M%S).json 2>/dev/null || echo "$(RED)Aucune base à sauvegarder$(NC)"
	@echo "$(GREEN)✓ Sauvegarde créée$(NC)"

har-list: ## Liste les fichiers HAR enregistrés
	@echo "$(YELLOW)Fichiers HAR:$(NC)"
	@ls -lh har/*.har 2>/dev/null | awk '{print "  " $$9 " (" $$5 ")"}' || echo "$(RED)Aucun fichier HAR$(NC)"
	@echo ""
	@du -sh har 2>/dev/null | awk '{print "Total: " $$1}' || true

har-clean: ## Supprime tous les fichiers HAR
	@echo "$(YELLOW)Suppression des fichiers HAR...$(NC)"
	@rm -rf har/
	@echo "$(GREEN)✓ Fichiers HAR supprimés$(NC)"

har-clean-old: ## Supprime les fichiers HAR de plus de 7 jours
	@echo "$(YELLOW)Suppression des fichiers HAR de plus de 7 jours...$(NC)"
	@find har -name "*.har" -type f -mtime +7 -delete 2>/dev/null || echo "$(RED)Aucun fichier HAR ancien$(NC)"
	@echo "$(GREEN)✓ Fichiers HAR anciens supprimés$(NC)"

setup: install build playwright ## Installation complète du projet
	@echo "$(GREEN)✓ Installation complète terminée!$(NC)"
	@echo ""
	@echo "$(YELLOW)Prochaines étapes:$(NC)"
	@echo "  1. make start URL=https://example.com"
	@echo "  2. Ouvrir http://localhost:$(PORT)"
	@echo ""

info: ## Affiche les informations du projet
	@echo "$(GREEN)CSS Intelligence Platform$(NC)"
	@echo ""
	@echo "$(YELLOW)Version Node.js:$(NC) $$(node --version)"
	@echo "$(YELLOW)Version npm:$(NC) $$(npm --version)"
	@echo "$(YELLOW)Répertoire:$(NC) $$(pwd)"
	@echo "$(YELLOW)Port:$(NC) $(PORT)"
	@echo "$(YELLOW)URL de base:$(NC) $(URL)"
	@echo ""
	@echo "$(YELLOW)Fichiers:$(NC)"
	@echo "  - Base de données: css-audit-data.json"
	@echo "  - Logs: logs/"
	@echo "  - Build: dist/"
	@echo "  - HAR files: har/"
	@echo ""

dashboard: ## Ouvre le dashboard dans le navigateur
	@echo "$(GREEN)Ouverture du dashboard...$(NC)"
	@xdg-open http://localhost:$(PORT) 2>/dev/null || open http://localhost:$(PORT) 2>/dev/null || echo "Ouvrez manuellement: http://localhost:$(PORT)"

# Raccourcis pratiques
s: start ## Raccourci pour start
r: restart ## Raccourci pour restart
l: logs ## Raccourci pour logs
t: test ## Raccourci pour test
