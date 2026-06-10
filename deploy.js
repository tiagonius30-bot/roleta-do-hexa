/**
 * deploy.js — Roleta do Hexa
 * Faz deploy automático no Netlify via API.
 *
 * Como usar:
 *   node deploy.js
 *
 * Requisito: Node.js instalado (node --version para verificar)
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');
const zlib  = require('zlib');

// ── Configuração ──────────────────────────────
const TOKEN   = 'nfp_HvMLrUcgavZG6b6QDnEi6qBjAvvHbBQo6fdb';
const SITE_ID = 'darling-dolphin-d28d45'; // nome ou ID do site
const FILE    = path.join(__dirname, 'roleta.html');
// ─────────────────────────────────────────────

async function deploy() {
  console.log('📦 Lendo roleta.html...');
  const html = fs.readFileSync(FILE);

  // Netlify aceita zip com os arquivos do site
  // Vamos usar a API de "digest" para deploy de arquivo único
  console.log('🔍 Buscando ID do site...');

  const siteInfo = await request('GET', `/api/v1/sites/${SITE_ID}`, null, TOKEN);
  const realId   = siteInfo.id;
  console.log(`✅ Site encontrado: ${siteInfo.name} (${realId})`);

  // Cria o deploy com digest do arquivo
  const crypto   = require('crypto');
  const digest   = crypto.createHash('sha1').update(html).digest('hex');

  console.log('🚀 Criando deploy...');
  const deploy = await request('POST', `/api/v1/sites/${realId}/deploys`, {
    files: { '/index.html': digest }
  }, TOKEN);

  const deployId = deploy.id;
  console.log(`📡 Deploy ID: ${deployId}`);

  // Faz upload do arquivo
  console.log('⬆️  Enviando arquivo...');
  await uploadFile(realId, deployId, digest, html, TOKEN);

  console.log('');
  console.log('✅ Deploy concluído!');
  console.log(`🌐 URL: https://${siteInfo.default_domain || SITE_ID + '.netlify.app'}`);
}

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.netlify.com',
      port: 443,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };

    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error(`Resposta inválida: ${raw}`)); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function uploadFile(siteId, deployId, digest, content, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.netlify.com',
      port: 443,
      path: `/api/v1/deploys/${deployId}/files/index.html`,
      method: 'PUT',
      headers: {
        'Authorization':  `Bearer ${token}`,
        'Content-Type':   'application/octet-stream',
        'Content-Length': content.length,
      }
    };

    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve(raw));
    });
    req.on('error', reject);
    req.write(content);
    req.end();
  });
}

deploy().catch(err => {
  console.error('❌ Erro:', err.message || err);
  process.exit(1);
});
