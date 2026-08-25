#!/usr/bin/env node
// Real-time iFood status test — polls for new orders and tests each step
const https = require('https');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const MERCHANT_ID = '3983310';
const CLIENT_ID = process.env.IFOOD_CLIENT_ID;
const CLIENT_SECRET = process.env.IFOOD_CLIENT_SECRET;

function auth() {
  return new Promise((resolve) => {
    const data = new URLSearchParams({ grantType: 'client_credentials', clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }).toString();
    const req = https.request({
      hostname: 'merchant-api.ifood.com.br', path: '/authentication/v1.0/oauth/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data), 'Accept-Encoding': 'identity' }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(JSON.parse(body).accessToken));
    });
    req.write(data);
    req.end();
  });
}

function callIfood(token, orderId, action, body = {}) {
  return new Promise((resolve) => {
    const bodyStr = JSON.stringify(body);
    const req = https.request({
      hostname: 'merchant-api.ifood.com.br',
      path: `/order/v1.0/orders/${orderId}/${action}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'MerchantId': MERCHANT_ID,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'Accept-Encoding': 'identity'
      }
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        const ok = [200, 202, 204].includes(res.statusCode);
        console.log(`  ${ok ? '✅' : '❌'} /${action} [${res.statusCode}] ${bodyStr !== '{}' ? bodyStr : ''} ${b.substring(0, 200)}`);
        resolve(res.statusCode);
      });
    });
    req.on('error', (e) => { console.log(`  ❌ /${action} ERROR:`, e.message); resolve(0); });
    req.write(bodyStr);
    req.end();
  });
}

async function pollForNewOrder(token) {
  const events = await new Promise((resolve) => {
    const req = https.request({
      hostname: 'merchant-api.ifood.com.br',
      path: '/order/v1.0/events:polling',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'MerchantId': MERCHANT_ID, 'Accept-Encoding': 'identity' }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve([]); } });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
  return Array.isArray(events) ? events.filter(e => ['PLACED', 'PLC'].includes(e.code)) : [];
}

async function main() {
  console.log('🔍 Polling for new iFood orders... (Ctrl+C to stop)\n');
  const token = await auth();
  const tested = new Set();

  while (true) {
    const events = await pollForNewOrder(token);
    for (const event of events) {
      if (tested.has(event.orderId)) continue;
      tested.add(event.orderId);

      console.log(`\n🆕 NEW ORDER: ${event.orderId}\n`);

      // STEP 1: confirm + startPreparation (like "Aceitar")
      console.log('STEP 1: Aceitar (confirm + startPreparation)');
      await callIfood(token, event.orderId, 'confirm');
      await callIfood(token, event.orderId, 'startPreparation');
      console.log('  → Check iFood portal: should be "Em preparo"\n');

      // STEP 2: readyToPickup
      await new Promise(r => setTimeout(r, 3000));
      console.log('STEP 2: Próximo (readyToPickup)');
      await callIfood(token, event.orderId, 'readyToPickup', { deliveredBy: 'MERCHANT' });
      console.log('  → Check iFood portal: should be "Pronto/Retirada"\n');

      // STEP 3: dispatch
      await new Promise(r => setTimeout(r, 3000));
      console.log('STEP 3: Próximo (dispatch)');
      await callIfood(token, event.orderId, 'dispatch', { deliveredBy: 'MERCHANT' });
      console.log('  → Check iFood portal: should be "Em rota/Entregue"\n');

      console.log('🏁 DONE — Check iFood portal now!');
      console.log(`   Order ID: ${event.orderId}\n`);
    }

    await new Promise(r => setTimeout(r, 15000)); // poll every 15s
  }
}

main().catch(console.error);
