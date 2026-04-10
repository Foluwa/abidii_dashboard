const fs = require('fs');
const { chromium } = require('playwright');

const BASE_URL = process.env.ABIDII_DASHBOARD_URL || 'http://127.0.0.1:3000';
const AUTH_PATH = process.env.ABIDII_AUTH_PATH || '/tmp/abidii_ui_auth.json';

const auth = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));

const workflows = [
  {
    id: 'dashboard',
    name: 'Overview Dashboard',
    route: '/dashboard',
    checks: ['Dashboard', 'Total Users', 'Platform Distribution', 'Monthly User Growth', 'Monthly Subscriber Growth', 'Customer Demographics'],
    pagination: false,
  },
  {
    id: 'operations_alerts',
    name: 'Operations Alerts',
    route: '/operations/alerts',
    checks: ['Alert History', 'Sent At', 'Level', 'Category', 'Message'],
    pagination: true,
  },
  {
    id: 'operations_idempotency',
    name: 'Operations Idempotency',
    route: '/operations/idempotency',
    checks: ['Idempotency Health', 'Total Keys', 'Active Keys', 'Duplicate Attempts', 'Idempotency Performance'],
    pagination: false,
  },
  {
    id: 'operations_cron',
    name: 'Operations Cron Jobs',
    route: '/operations/cron-jobs',
    checks: ['Cron Jobs', 'Scheduled Jobs', 'Recent Executions'],
    pagination: false,
  },
  {
    id: 'community_billing_subscriptions',
    name: 'Community Billing Subscriptions',
    route: '/community/billing',
    checks: ['Billing Operations', 'Active Subscriptions', 'Total Subscriptions'],
    pagination: true,
  },
  {
    id: 'community_billing_events',
    name: 'Community Billing Events',
    route: '/community/billing/events',
    checks: ['Billing Operations', 'Recent Subscription Events', 'Event Type'],
    pagination: true,
  },
  {
    id: 'community_billing_attempts',
    name: 'Community Billing Verification Attempts',
    route: '/community/billing/verification-attempts',
    checks: ['Billing Operations', 'Recent Verification Attempts', 'Provider'],
    pagination: true,
  },
  {
    id: 'content_library_hub',
    name: 'Content Library Hub',
    route: '/content/library',
    checks: ['Content Library', 'Words', 'Phrases', 'Time Phrases', 'Sentences', 'Proverbs', 'Letters', 'Numbers'],
    pagination: false,
  },
  {
    id: 'content_words',
    name: 'Content Words',
    route: '/content/library/words',
    checks: ['Lexicon Entries', 'Search', 'Bulk Actions'],
    pagination: true,
  },
  {
    id: 'content_phrases',
    name: 'Content Phrases',
    route: '/content/library/phrases',
    checks: ['Phrases Management', 'Regenerate Selected Audio'],
    pagination: true,
  },
  {
    id: 'content_time_phrases',
    name: 'Content Time Phrases',
    route: '/content/library/time-phrases',
    checks: ['Time Phrases Management', 'Regenerate Selected Audio'],
    pagination: true,
  },
  {
    id: 'content_numbers',
    name: 'Content Numbers',
    route: '/content/library/numbers',
    checks: ['Numbers Management', 'Regenerate Selected Audio'],
    pagination: true,
  },
  {
    id: 'content_games_alias',
    name: 'Content Games Alias View',
    route: '/content/library/games',
    checks: ['Games Management'],
    pagination: false,
  },
];

async function checkText(page, text) {
  const locator = page.getByText(text, { exact: false }).first();
  try {
    await locator.waitFor({ state: 'visible', timeout: 8000 });
    return { ok: true, detail: `Found text: ${text}` };
  } catch {
    return { ok: false, detail: `Missing text: ${text}` };
  }
}

async function checkPagination(page) {
  const nextBtn = page.getByRole('button', { name: 'Next' }).first();
  const count = await nextBtn.count();
  if (!count) {
    return { ok: false, detail: 'Pagination control (Next) not found' };
  }

  const before = (await page.locator('button[aria-current="page"]').first().textContent())?.trim() || null;
  const disabled = await nextBtn.isDisabled();
  if (disabled) {
    return { ok: true, detail: `Pagination present; next disabled (single-page or end-page). Current=${before ?? 'unknown'}` };
  }

  await nextBtn.click({ timeout: 5000 });
  await page.waitForTimeout(1200);
  const after = (await page.locator('button[aria-current="page"]').first().textContent())?.trim() || null;
  if (before && after && before !== after) {
    return { ok: true, detail: `Pagination advanced from ${before} to ${after}` };
  }

  return { ok: false, detail: `Pagination click did not advance page (before=${before}, after=${after})` };
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });

  const context = await browser.newContext({
    viewport: { width: 1536, height: 960 },
  });

  await context.addInitScript((seed) => {
    sessionStorage.setItem('access_token', seed.access_token);
    sessionStorage.setItem('refresh_token', seed.refresh_token || seed.access_token);
    sessionStorage.setItem('token_expiry', String(Date.now() + 2 * 60 * 60 * 1000));
    sessionStorage.setItem('user', JSON.stringify(seed.user));
    document.cookie = `user=${encodeURIComponent(JSON.stringify(seed.user))}; path=/; SameSite=Strict`;
  }, auth);

  const page = await context.newPage();

  const results = [];

  for (const workflow of workflows) {
    const row = {
      id: workflow.id,
      name: workflow.name,
      route: workflow.route,
      status: 'PASS',
      notes: [],
      apiErrors: [],
      consoleErrors: [],
      checkedAt: new Date().toISOString(),
    };

    const routeApiErrors = [];
    const routeConsoleErrors = [];

    const respHandler = (resp) => {
      const url = resp.url();
      if (!url.includes('127.0.0.1:8010/api/v1/')) return;
      if (resp.status() >= 400) {
        routeApiErrors.push(`${resp.status()} ${url}`);
      }
    };

    const consoleHandler = (msg) => {
      if (msg.type() === 'error') {
        routeConsoleErrors.push(msg.text());
      }
    };

    page.on('response', respHandler);
    page.on('console', consoleHandler);

    try {
      await page.goto(`${BASE_URL}${workflow.route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(2000);

      const currentPath = new URL(page.url()).pathname;
      if (currentPath === '/' || currentPath === '/signin') {
        row.status = 'FAIL';
        row.notes.push(`Redirected to auth route: ${currentPath}`);
      }

      for (const expectedText of workflow.checks) {
        const check = await checkText(page, expectedText);
        row.notes.push(`${check.ok ? 'PASS' : 'FAIL'}: ${check.detail}`);
        if (!check.ok) row.status = 'FAIL';
      }

      if (workflow.pagination) {
        const paginationCheck = await checkPagination(page);
        row.notes.push(`${paginationCheck.ok ? 'PASS' : 'FAIL'}: ${paginationCheck.detail}`);
        if (!paginationCheck.ok) row.status = 'FAIL';
      }

      row.apiErrors = [...new Set(routeApiErrors)];
      row.consoleErrors = [...new Set(routeConsoleErrors)];

      const authOrServerErrors = row.apiErrors.filter((line) => /(401|403|404|500|502|503|504)\s/.test(line));
      if (authOrServerErrors.length > 0) {
        row.status = 'FAIL';
        row.notes.push(`FAIL: API errors detected (${authOrServerErrors.length})`);
      }
    } catch (error) {
      row.status = 'FAIL';
      row.notes.push(`FAIL: Exception while testing route: ${error?.message || String(error)}`);
    } finally {
      page.off('response', respHandler);
      page.off('console', consoleHandler);
    }

    results.push(row);
  }

  await browser.close();

  const summary = {
    baseUrl: BASE_URL,
    total: results.length,
    passed: results.filter((r) => r.status === 'PASS').length,
    failed: results.filter((r) => r.status === 'FAIL').length,
    generatedAt: new Date().toISOString(),
    results,
  };

  fs.writeFileSync('/tmp/abidii_auth_ui_smoke_results.json', JSON.stringify(summary, null, 2));

  console.log(`TOTAL=${summary.total} PASS=${summary.passed} FAIL=${summary.failed}`);
  for (const r of results) {
    console.log(`${r.status}\t${r.route}\t${r.name}`);
  }
})();
