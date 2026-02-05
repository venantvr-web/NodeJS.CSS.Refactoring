#!/usr/bin/env node
/**
 * Script de test pour l'API Agent
 * Démontre comment utiliser les endpoints pour un scan autonome
 */

const http = require('http');

const API_BASE = 'http://localhost:3000';

// Helper pour faire des requêtes HTTP
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${json.error || data}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Helper pour attendre
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fonction principale de test
async function testAgentAPI() {
  console.log('🤖 Test de l\'API Agent\n');

  // URLs à scanner (modifiez selon vos besoins)
  const urlsToScan = [
    'https://recipe.concilio.com',
    'https://recipe.concilio.com/recettes',
  ];

  console.log(`📋 URLs à scanner: ${urlsToScan.length}`);
  urlsToScan.forEach((url) => console.log(`   - ${url}`));
  console.log();

  try {
    // 1. Lancer le scan
    console.log('🚀 Lancement du scan...');
    const scanResponse = await request('POST', '/api/agent/scan', {
      urls: urlsToScan,
    });

    console.log(`✅ Scan lancé: ${scanResponse.scanId}`);
    console.log(`   Status: ${scanResponse.status}`);
    console.log(`   URLs: ${scanResponse.totalUrls}`);
    console.log();

    // 2. Polling du statut
    console.log('⏳ Attente de la fin du scan...');
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (attempts < maxAttempts) {
      const statusResponse = await request('GET', '/api/agent/status');

      if (!statusResponse.scanning) {
        console.log(`✅ Scan terminé après ${attempts * 5} secondes`);
        console.log(
          `   Dernier scan: ${new Date(statusResponse.lastScan).toLocaleString('fr-FR')}`
        );
        console.log();
        break;
      }

      process.stdout.write(`   Scan en cours (${attempts * 5}s)...\r`);
      await sleep(5000);
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('Timeout: Le scan a pris trop de temps');
    }

    // 3. Récupérer les résultats
    console.log('📊 Récupération des résultats...');
    const urlsParam = urlsToScan.join(',');
    const resultsResponse = await request(
      'GET',
      `/api/agent/results?urls=${encodeURIComponent(urlsParam)}`
    );

    console.log('✅ Résultats récupérés\n');

    // 4. Afficher le résumé
    console.log('📈 Résumé:');
    console.log(`   URLs analysées: ${resultsResponse.summary.totalUrls}`);
    console.log(`   Erreurs totales: ${resultsResponse.summary.totalErrors}`);
    console.log(`   Score moyen: ${resultsResponse.summary.averageHealthScore}/100`);
    console.log();

    // 5. Afficher les détails par URL
    console.log('📋 Détails par URL:\n');
    resultsResponse.results.forEach((result) => {
      const statusIcon = result.status === 'success' ? '✅' : '❌';
      const healthColor =
        result.healthScore >= 80 ? '🟢' : result.healthScore >= 50 ? '🟡' : '🔴';

      console.log(`${statusIcon} ${result.url}`);
      console.log(`   Score: ${healthColor} ${result.healthScore}/100`);
      console.log(`   Erreurs: ${result.errorCount}`);

      if (result.errorCount > 0) {
        // Grouper par sévérité
        const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
        result.errors.forEach((err) => {
          bySeverity[err.severity]++;
        });

        console.log('   Détail:');
        if (bySeverity.critical > 0)
          console.log(`      🔴 Critical: ${bySeverity.critical}`);
        if (bySeverity.high > 0) console.log(`      🟠 High: ${bySeverity.high}`);
        if (bySeverity.medium > 0) console.log(`      🟡 Medium: ${bySeverity.medium}`);
        if (bySeverity.low > 0) console.log(`      🟢 Low: ${bySeverity.low}`);

        // Afficher quelques erreurs exemple
        console.log('   Exemples d\'erreurs:');
        result.errors.slice(0, 3).forEach((err) => {
          console.log(`      - [${err.severity.toUpperCase()}] ${err.message}`);
        });

        if (result.errors.length > 3) {
          console.log(`      ... et ${result.errors.length - 3} autres`);
        }
      }

      console.log();
    });

    // 6. Test de pagination
    if (resultsResponse.pagination.total > 1) {
      console.log('🔍 Test de pagination...');
      const pageResponse = await request(
        'GET',
        `/api/agent/results?urls=${encodeURIComponent(urlsParam)}&offset=0&limit=1`
      );

      console.log(`   Récupéré ${pageResponse.pagination.returned} résultat(s)`);
      console.log(`   Total: ${pageResponse.pagination.total}`);
      console.log(`   Encore des résultats: ${pageResponse.pagination.hasMore}`);
      console.log();
    }

    console.log('✨ Test terminé avec succès !');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

// Exécuter le test
console.log('Assurez-vous que le serveur est démarré: npm run dev serve\n');
testAgentAPI();
