/**
 * Script de diagnostic PISTE — lance avec: node test-piste.js
 */
const https = require('https');

const CLIENT_ID     = '8de9ef43-56d3-4cb8-9615-778c7b4de437';
const CLIENT_SECRET = '569438b2-33e6-445e-b46d-e81c189b4023';
const OAUTH_URL     = 'https://sandbox-oauth.piste.gouv.fr/api/oauth/token';
const API_BASE      = 'https://sandbox-api.piste.gouv.fr/dila/legifrance/lf-engine-app';

function post(url, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const opts = {
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Length': Buffer.byteLength(data), ...headers }
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('\n🔑 Étape 1 — Token OAuth...');
  const tokenResp = await post(OAUTH_URL,
    `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&scope=openid`,
    { 'Content-Type': 'application/x-www-form-urlencoded' }
  );
  console.log('   Status:', tokenResp.status);
  if (tokenResp.status !== 200) {
    console.log('   ❌ Erreur OAuth:', JSON.stringify(tokenResp.body));
    return;
  }
  const token = tokenResp.body.access_token;
  console.log('   ✅ Token OK:', token.substring(0, 30) + '…');

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  // Test formats différents
  const tests = [
    {
      name: 'Format standard CODE_DATE',
      body: {
        recherche: {
          champs: [{ typeChamp: 'ALL', criteres: [{ typeRecherche: 'TOUS_LES_MOTS', valeur: 'responsabilité' }], operateur: 'ET' }],
          filtres: [{ facette: 'ETAT', valeur: 'VIGUEUR' }],
          pageNumber: 1, pageSize: 5, operateur: 'ET', typePagination: 'ARTICLE'
        },
        fond: 'CODE_DATE'
      }
    },
    {
      name: 'Format sans filtres CODE_DATE',
      body: {
        recherche: {
          champs: [{ typeChamp: 'ALL', criteres: [{ typeRecherche: 'TOUS_LES_MOTS', valeur: 'responsabilité' }], operateur: 'ET' }],
          filtres: [],
          pageNumber: 1, pageSize: 5, operateur: 'ET', typePagination: 'ARTICLE'
        },
        fond: 'CODE_DATE'
      }
    },
    {
      name: 'Format LEGI',
      body: {
        recherche: {
          champs: [{ typeChamp: 'ALL', criteres: [{ typeRecherche: 'TOUS_LES_MOTS', valeur: 'responsabilité' }], operateur: 'ET' }],
          filtres: [],
          pageNumber: 1, pageSize: 5, operateur: 'ET', typePagination: 'ARTICLE'
        },
        fond: 'LEGI'
      }
    },
    {
      name: 'Format ALL',
      body: {
        recherche: {
          champs: [{ typeChamp: 'ALL', criteres: [{ typeRecherche: 'TOUS_LES_MOTS', valeur: 'responsabilité' }], operateur: 'ET' }],
          filtres: [],
          pageNumber: 1, pageSize: 5, operateur: 'ET', typePagination: 'ARTICLE'
        },
        fond: 'ALL'
      }
    },
  ];

  for (const t of tests) {
    console.log(`\n📡 ${t.name}...`);
    try {
      const r = await post(`${API_BASE}/search`, t.body, authHeaders);
      console.log('   Status:', r.status);
      if (r.status === 200) {
        console.log('   ✅ SUCCÈS! Résultats:', r.body?.results?.length || 0);
        if (r.body?.results?.[0]) console.log('   Premier résultat:', r.body.results[0].titre || r.body.results[0].title || JSON.stringify(r.body.results[0]).substring(0, 100));
        console.log('\n🎉 FORMAT QUI MARCHE:', t.name);
        console.log('   fond:', t.body.fond);
        break;
      } else {
        console.log('   ❌', JSON.stringify(r.body).substring(0, 200));
      }
    } catch(e) {
      console.log('   ❌ Erreur réseau:', e.message);
    }
  }
}

run().catch(console.error);
