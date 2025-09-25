const out = document.getElementById('result');

// Helper pour afficher les résultats
function showResult(data) {
  out.textContent = JSON.stringify(data, null, 2);
}

function showError(error) {
  out.textContent = `❌ Erreur: ${error.message || error}`;
}

function showLoading(message) {
  out.textContent = `⏳ ${message}...`;
}

// Test Ping API
document.getElementById('ping-btn')?.addEventListener('click', async () => {
  showLoading('Test de connexion');
  try {
    const res = await fetch('/api/ping');
    const data = await res.json();
    showResult(data);
  } catch (err) {
    showError(err);
  }
});

// Test scraping d'une fiche détail
document.getElementById('scrape-detail-btn')?.addEventListener('click', async () => {
  showLoading('Scraping d\'une fiche détail');
  try {
    const customUrl = document.getElementById('custom-url').value;
    const url = customUrl || 'https://edv.travel/annuaire-des-adherents/fiche-adherent/?id=52213';
    const res = await fetch(`/api/scrape/detail?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    showResult(data);
  } catch (err) {
    showError(err);
  }
});

// Test des liens d'une page
document.getElementById('test-links-btn')?.addEventListener('click', async () => {
  const page = prompt('Quelle page tester ? (1-111)', '1');
  if (!page) return;
  
  showLoading(`Test des liens de la page ${page}`);
  try {
    const res = await fetch(`/api/test/links?page=${page}`);
    const data = await res.json();
    
    if (data.ok) {
      const summary = {
        page: data.page,
        url: data.url,
        totalLinks: data.totalLinks,
        message: `✅ Page ${data.page}: ${data.totalLinks} liens trouvés`,
        sampleLinks: data.sampleLinks,
        allLinks: data.links
      };
      showResult(summary);
    } else {
      showResult(data);
    }
  } catch (err) {
    showError(err);
  }
});

// Scraper UNE PAGE COMPLÈTE avec toutes les informations
document.getElementById('scrape-page-btn')?.addEventListener('click', async () => {
  const page = prompt('Quelle page scraper complètement ? (1-111)', '1');
  if (!page) return;
  
  if (!confirm(`⚠️ Vous allez scraper TOUTES les fiches de la page ${page} (~30 entreprises). Cela peut prendre 15-20 minutes. Continuer ?`)) {
    return;
  }
  
  showLoading(`Scraping complet de la page ${page} en cours...`);
  
  try {
    const res = await fetch(`/api/scrape/page?page=${page}`);
    const data = await res.json();
    
    if (data.ok) {
      // Afficher un résumé avec aperçu des données
      const summary = {
        success: true,
        page: data.page,
        url: data.url,
        statistics: {
          totalLinks: data.totalLinks,
          successful: data.successful,
          errors: data.errors,
          successRate: data.successRate + '%'
        },
        sampleData: data.results.filter(r => !r.error).slice(0, 3).map(item => ({
          raison_sociale: item.raison_sociale,
          ville: item.ville,
          code_postal: item.code_postal,
          telephone: item.telephone,
          email: item.email
        })),
        message: `🎉 PAGE ${data.page} TERMINÉE!\n📊 ${data.successful}/${data.totalLinks} fiches scrapées avec succès (${data.successRate}%)`,
        fullResults: data.results
      };
      
      out.textContent = `🎉 SCRAPING PAGE ${data.page} TERMINÉ!\n\n` +
        `📊 STATISTIQUES:\n` +
        `• Total de liens: ${data.totalLinks}\n` +
        `• Succès: ${data.successful}\n` +
        `• Erreurs: ${data.errors}\n` +
        `• Taux de succès: ${data.successRate}%\n\n` +
        `📋 APERÇU DES 3 PREMIÈRES ENTREPRISES:\n\n` +
        JSON.stringify(summary.sampleData, null, 2) + 
        `\n\n💾 DONNÉES COMPLÈTES:\n(Voir la console du navigateur pour toutes les données)`;
      
      // Log des données complètes dans la console
      console.log('🗂️ DONNÉES COMPLÈTES DE LA PAGE:', data.results);
      
    } else {
      showResult(data);
    }
  } catch (err) {
    showError(err);
  }
});

// Scraper UNE PAGE ULTRA-RAPIDE (3 minutes max)
document.getElementById('scrape-page-fast-btn')?.addEventListener('click', async () => {
  const page = prompt('Quelle page scraper en mode ULTRA-RAPIDE ? (1-111)', '1');
  if (!page) return;
  
  const concurrency = prompt('Combien de fiches en parallèle ? (1-8, recommandé: 5)', '5');
  if (!concurrency) return;
  
  if (!confirm(`⚡ SCRAPING ULTRA-RAPIDE de la page ${page} avec ${concurrency} fiches en parallèle.\nTemps estimé: 2-3 minutes. Continuer ?`)) {
    return;
  }
  
  showLoading(`⚡ Scraping ultra-rapide de la page ${page} (${concurrency} en parallèle)...`);
  
  const startTime = Date.now();
  
  try {
    const res = await fetch(`/api/scrape/page/fast?page=${page}&concurrency=${concurrency}`);
    const data = await res.json();
    
    if (data.ok) {
      const endTime = Date.now();
      const clientDuration = Math.round((endTime - startTime) / 1000);
      
      const summary = {
        success: true,
        method: data.method,
        page: data.page,
        concurrency: data.concurrency,
        statistics: {
          totalLinks: data.totalLinks,
          successful: data.successful,
          errors: data.errors,
          successRate: data.successRate + '%',
          duration: data.duration + 's',
          speed: data.speed
        },
        sampleData: data.results.filter(r => !r.error).slice(0, 3).map(item => ({
          raison_sociale: item.raison_sociale,
          ville: item.ville,
          code_postal: item.code_postal,
          telephone: item.telephone,
          email: item.email
        }))
      };
      
      out.textContent = `⚡ SCRAPING ULTRA-RAPIDE TERMINÉ!\n\n` +
        `📊 STATISTIQUES:\n` +
        `• Page: ${data.page}\n` +
        `• Méthode: ${data.method}\n` +
        `• Concurrence: ${data.concurrency} fiches en parallèle\n` +
        `• Total de liens: ${data.totalLinks}\n` +
        `• Succès: ${data.successful}\n` +
        `• Erreurs: ${data.errors}\n` +
        `• Taux de succès: ${data.successRate}%\n` +
        `• Durée: ${data.duration}s\n` +
        `• Vitesse: ${data.speed}\n\n` +
        `📋 APERÇU DES 3 PREMIÈRES ENTREPRISES:\n\n` +
        JSON.stringify(summary.sampleData, null, 2) + 
        `\n\n💾 DONNÉES COMPLÈTES:\n(Voir la console du navigateur)`;
      
      console.log('⚡ DONNÉES COMPLÈTES (ULTRA-RAPIDE):', data.results);
      
    } else {
      showResult(data);
    }
  } catch (err) {
    showError(err);
  }
});

// Test scraping de la liste (5 fiches)
document.getElementById('scrape-list-btn')?.addEventListener('click', async () => {
  showLoading('Scraping de 5 fiches depuis la liste');
  try {
    const res = await fetch('/api/scrape?limit=5');
    const data = await res.json();
    
    // Afficher des stats détaillées
    if (data && Array.isArray(data)) {
      const stats = {
        total_scraped: data.length,
        successful: data.filter(d => !d.error).length,
        errors: data.filter(d => d.error).length,
        sample_data: data.slice(0, 3),
        full_results: data
      };
      showResult(stats);
    } else {
      showResult(data);
    }
  } catch (err) {
    showError(err);
  }
});

// Test export vers Google Sheets
document.getElementById('export-btn')?.addEventListener('click', async () => {
  showLoading('Test d\'export vers Google Sheets');
  try {
    const testData = [
      ['ID', 'Raison sociale', 'Email', 'Téléphone'],
      ['TEST1', 'Entreprise Test', 'test@example.com', '01 23 45 67 89'],
      ['TEST2', 'Autre Test', 'autre@example.com', '01 98 76 54 32']
    ];
    
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spreadsheetId: '1ofcXp6KwLPbO7TJOdJ3Y4lSh4e4Jc5x2GIQ3GIjEgC4',
        range: 'ScrapSheet!A1',
        rows: testData
      })
    });
    
    const data = await res.json();
    showResult(data);
  } catch (err) {
    showError(err);
  }
});

// Test scraping complet de toutes les pages
document.getElementById('scrape-all-btn')?.addEventListener('click', async () => {
  const maxPages = document.getElementById('max-pages').value || 5;
  const batchSize = document.getElementById('batch-size').value || 5;
  
  if (!confirm(`⚠️ Vous allez scraper ${maxPages} pages. Cela peut prendre plusieurs minutes. Continuer ?`)) {
    return;
  }
  
  showLoading(`Scraping de ${maxPages} pages en cours (batch: ${batchSize})`);
  
  try {
    const res = await fetch(`/api/scrape/all?maxPages=${maxPages}&batchSize=${batchSize}`);
    const data = await res.json();
    
    if (data.ok) {
      out.textContent = `🎉 SCRAPING TERMINÉ!\n\n` +
        `📊 Total scraped: ${data.count} fiches\n` +
        `📋 Aperçu des 3 premiers résultats:\n\n` +
        JSON.stringify(data.data.slice(0, 3), null, 2);
    } else {
      showResult(data);
    }
  } catch (err) {
    showError(err);
  }
});

// SCRAPE SIMPLE + GOOGLE SHEETS - Une page directement vers Google Sheets
document.getElementById('scrape-simple-btn')?.addEventListener('click', async () => {
  const page = document.getElementById('single-page').value || 1;
  
  if (!confirm(`🚀 Scraper la page ${page} et exporter vers Google Sheets ?`)) {
    return;
  }
  
  showLoading(`Scraping page ${page} et export vers Google Sheets`);
  
  try {
    const res = await fetch('/api/scrape-simple', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ page: Number(page) })
    });
    
    const data = await res.json();
    
    if (data.ok) {
      out.textContent = `✅ SCRAPING SIMPLE TERMINÉ!\n\n` +
        `📄 Page: ${data.page}\n` +
        `📊 Entreprises trouvées: ${data.count}\n` +
        `⏱️ Durée: ${data.duration}s\n` +
        `📈 Google Sheets: ${data.googleSheetsResult ? 'Export réussi' : 'Erreur export'}\n\n` +
        `💬 ${data.message}`;
    } else {
      showResult(data);
    }
  } catch (err) {
    showError(err);
  }
});

// SCRAPE PLUSIEURS PAGES - Range de pages vers Google Sheets
document.getElementById('scrape-multiple-btn')?.addEventListener('click', async () => {
  const startPage = document.getElementById('start-page').value || 1;
  const endPage = document.getElementById('end-page').value || 5;
  
  const totalPages = endPage - startPage + 1;
  const estimatedTime = Math.round(totalPages * 2); // ~2min par page
  
  if (!confirm(`🚀 Scraper les pages ${startPage} à ${endPage} (${totalPages} pages) et exporter vers Google Sheets ?\n\n⏱️ Temps estimé: ~${estimatedTime} minutes`)) {
    return;
  }
  
  showLoading(`Scraping pages ${startPage}-${endPage} et export vers Google Sheets`);
  
  try {
    const res = await fetch('/api/scrape-multiple', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        startPage: Number(startPage), 
        endPage: Number(endPage) 
      })
    });
    
    const data = await res.json();
    
    if (data.ok) {
      out.textContent = `✅ SCRAPING MULTIPLE TERMINÉ!\n\n` +
        `📄 Pages: ${data.startPage} à ${data.endPage}\n` +
        `📋 Pages traitées: ${data.totalPages}\n` +
        `📊 Total entreprises: ${data.count}\n` +
        `📈 Moyenne/page: ${data.averagePerPage}\n` +
        `❌ Erreurs: ${data.errors}\n` +
        `⏱️ Durée totale: ${data.duration}s (${Math.round(data.duration/60)}min)\n` +
        `📈 Google Sheets: ${data.googleSheetsResult ? 'Export réussi' : 'Erreur export'}\n\n` +
        `💬 ${data.message}`;
    } else {
      showResult(data);
    }
  } catch (err) {
    showError(err);
  }
});

// SCRAPE PAGINÉ (export page par page)
document.getElementById('scrape-paginated-btn')?.addEventListener('click', async () => {
  const startPage = document.getElementById('start-page').value || 1;
  const endPage = document.getElementById('end-page').value || 5;

  const concurrency = prompt('Concurrence (fiches en parallèle, recommandé 10-12):', '10') || '10';
  const timeoutMs = prompt('Timeout par fiche (ms):', '10000') || '10000';
  const batchDelay = prompt('Pause entre batches (ms):', '200') || '200';

  if (!confirm(`📑 Scraper par pages ${startPage} → ${endPage} (export par page) ?`)) return;

  showLoading(`📑 Scraping paginé ${startPage}-${endPage} (concurrency ${concurrency})...`);

  try {
    const res = await fetch('/api/scrape-paginated', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startPage: Number(startPage),
        endPage: Number(endPage),
        concurrency: Number(concurrency),
        timeoutMs: Number(timeoutMs),
        batchDelay: Number(batchDelay)
      })
    });

    const data = await res.json();

    if (data.ok) {
      out.textContent = `✅ SCRAPE PAGINÉ TERMINÉ!\n` +
        `Pages: ${data.startPage}-${data.endPage} (total ${data.totalPages})\n` +
        `Total liens: ${data.totalLinks}\n` +
        `Exportés: ${data.totalExported}\n` +
        `Concurrence: ${data.concurrency}\n` +
        `Durée: ${data.duration}s\n\n` +
        `Détail par page:\n` + JSON.stringify(data.pages, null, 2);
    } else {
      showResult(data);
    }
  } catch (err) {
    showError(err);
  }
});
