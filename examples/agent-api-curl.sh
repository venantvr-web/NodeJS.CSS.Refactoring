#!/bin/bash
# Script de test de l'API Agent avec curl

API_BASE="http://localhost:3000"

echo "🤖 Test de l'API Agent avec curl"
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Lancer le scan
echo -e "${YELLOW}1. Lancement du scan...${NC}"
SCAN_RESPONSE=$(curl -s -X POST "${API_BASE}/api/agent/scan" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://recipe.concilio.com",
      "https://recipe.concilio.com/recettes"
    ]
  }')

echo "$SCAN_RESPONSE" | jq '.'
SCAN_ID=$(echo "$SCAN_RESPONSE" | jq -r '.scanId')
echo -e "${GREEN}✅ Scan lancé: $SCAN_ID${NC}"
echo ""

# 2. Attendre quelques secondes
echo -e "${YELLOW}2. Attente de 10 secondes...${NC}"
sleep 10
echo ""

# 3. Vérifier le statut
echo -e "${YELLOW}3. Vérification du statut...${NC}"
STATUS_RESPONSE=$(curl -s "${API_BASE}/api/agent/status")
echo "$STATUS_RESPONSE" | jq '.'

IS_SCANNING=$(echo "$STATUS_RESPONSE" | jq -r '.scanning')

if [ "$IS_SCANNING" = "true" ]; then
  echo -e "${YELLOW}⏳ Scan encore en cours, attendez quelques secondes...${NC}"
else
  echo -e "${GREEN}✅ Scan terminé${NC}"
fi
echo ""

# 4. Récupérer les résultats (une fois le scan terminé)
echo -e "${YELLOW}4. Récupération des résultats...${NC}"
URLS="https://recipe.concilio.com,https://recipe.concilio.com/recettes"
RESULTS_RESPONSE=$(curl -s "${API_BASE}/api/agent/results?urls=${URLS}")

echo "$RESULTS_RESPONSE" | jq '.'
echo ""

# 5. Afficher le résumé
echo -e "${YELLOW}5. Résumé:${NC}"
echo "$RESULTS_RESPONSE" | jq '.summary'

TOTAL_ERRORS=$(echo "$RESULTS_RESPONSE" | jq -r '.summary.totalErrors')
AVG_SCORE=$(echo "$RESULTS_RESPONSE" | jq -r '.summary.averageHealthScore')

echo ""
echo -e "${GREEN}Erreurs totales: $TOTAL_ERRORS${NC}"
echo -e "${GREEN}Score moyen: $AVG_SCORE/100${NC}"
echo ""

echo "✨ Test terminé !"
echo ""
echo "Pour tester la pagination, utilisez:"
echo "  curl \"${API_BASE}/api/agent/results?urls=${URLS}&offset=0&limit=1\" | jq"
