/**
 * Test RevenueCat credentials from local .env files (no secrets printed).
 *
 * Usage (from client folder):
 *   node scripts/test-revenuecat-credentials.js
 *   node scripts/test-revenuecat-credentials.js --user user_3AB0XEwtrdHPBH1hlM3vRHPcSkl
 *
 * What goes where:
 * - EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY (goog_...) → client/.env → mobile SDK only
 * - EXPO_PUBLIC_REVENUECAT_IOS_API_KEY     (appl_...) → client/.env → mobile SDK only
 * - REVENUECAT_SECRET_API_KEY              (sk_...)    → server/.env → REST API / webhooks only
 * - App IDs (appa..., appf...)             → RevenueCat dashboard only (not pasted into app code)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const clientEnvPath = path.join(__dirname, '..', '.env');
const serverEnvPath = path.join(__dirname, '..', '..', 'server', '.env');
const testUserId = process.argv.includes('--user')
  ? process.argv[process.argv.indexOf('--user') + 1]
  : 'mediping_credential_test_user';

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const env = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value.trim();
  }

  return env;
};

const maskKey = (key) => {
  if (!key) {
    return '(missing)';
  }
  if (key.length < 12) {
    return '(too short)';
  }
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
};

const requestRevenueCat = ({ apiKey, platform, route, method = 'GET' }) =>
  new Promise((resolve) => {
    const options = {
      hostname: 'api.revenuecat.com',
      port: 443,
      path: route,
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    };

    if (platform) {
      options.headers['X-Platform'] = platform;
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = body ? JSON.parse(body) : null;
        } catch {
          parsed = { raw: body };
        }

        resolve({
          status: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          body: parsed,
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        status: 0,
        ok: false,
        body: { message: error.message },
      });
    });

    req.end();
  });

const printResult = (label, result) => {
  const status = result.ok ? 'PASS' : 'FAIL';
  const message =
    result.body?.message ||
    result.body?.code ||
    (result.ok ? 'OK' : 'Request failed');

  console.log(`[${status}] ${label}`);
  console.log(`       HTTP ${result.status} — ${message}`);

  if (result.ok && result.body?.current_offering_id !== undefined) {
    const currentOffering =
      result.body.offerings?.find(
        (offering) => offering.identifier === result.body.current_offering_id
      ) || result.body.offerings?.[0];
    const packages = currentOffering?.packages || [];
    console.log(`       Offering: ${result.body.current_offering_id || '(none)'}`);
    console.log(`       Packages: ${packages.length}`);
    packages.forEach((pkg) => {
      const productId = pkg.platform_product_identifier || pkg.product?.identifier || 'n/a';
      const planId = pkg.platform_product_plan_identifier
        ? `:${pkg.platform_product_plan_identifier}`
        : '';
      console.log(`         - ${pkg.identifier}: ${productId}${planId}`);
    });
  }

  if (result.ok && result.body?.subscriber) {
    const entitlements = Object.keys(result.body.subscriber.entitlements || {});
    console.log(`       Subscriber entitlements: ${entitlements.length ? entitlements.join(', ') : '(none)'}`);
  }

  console.log('');
  return result.ok;
};

const main = async () => {
  const clientEnv = parseEnvFile(clientEnvPath);
  const serverEnv = parseEnvFile(serverEnvPath);

  const androidKey = clientEnv.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  const iosKey = clientEnv.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  const secretKey = serverEnv.REVENUECAT_SECRET_API_KEY;

  console.log('RevenueCat credential check\n');
  console.log('Loaded from:');
  console.log(`  client/.env  → Android SDK key ${maskKey(androidKey)}`);
  console.log(`  client/.env  → iOS SDK key     ${maskKey(iosKey)}`);
  console.log(`  server/.env  → Secret REST key ${maskKey(secretKey)}`);
  console.log(`  test user id → ${testUserId}`);
  console.log('');

  let passed = 0;
  let total = 0;

  if (androidKey) {
    total += 1;
    const result = await requestRevenueCat({
      apiKey: androidKey,
      platform: 'android',
      route: `/v1/subscribers/${encodeURIComponent(testUserId)}/offerings`,
    });
    if (printResult('Android public SDK key (client/.env)', result)) {
      passed += 1;
    }
  } else {
    console.log('[SKIP] Android public SDK key — missing in client/.env\n');
  }

  if (iosKey) {
    total += 1;
    const result = await requestRevenueCat({
      apiKey: iosKey,
      platform: 'ios',
      route: `/v1/subscribers/${encodeURIComponent(testUserId)}/offerings`,
    });
    if (printResult('iOS public SDK key (client/.env)', result)) {
      passed += 1;
    }
  } else {
    console.log('[SKIP] iOS public SDK key — missing in client/.env\n');
  }

  if (secretKey) {
    total += 1;
    const result = await requestRevenueCat({
      apiKey: secretKey,
      route: `/v1/subscribers/${encodeURIComponent(testUserId)}`,
    });
    if (printResult('Secret REST API key (server/.env)', result)) {
      passed += 1;
    }
  } else {
    console.log('[INFO] Secret REST API key not set in server/.env');
    console.log('       Add when you need server-side subscription checks / webhooks:');
    console.log('       REVENUECAT_SECRET_API_KEY=sk_...  (from RevenueCat → API keys → Secret)\n');
  }

  console.log(`Summary: ${passed}/${total} checks passed`);

  if (passed < total) {
    console.log('\nIf a public SDK key fails with 401 Invalid API Key:');
    console.log('  1. Copy the key again from RevenueCat → Apps → Public API key (copy button).');
    console.log('  2. Paste into client/.env without spaces.');
    console.log('  3. Restart Expo: npx expo start -c');
    process.exit(1);
  }

  process.exit(0);
};

main();
