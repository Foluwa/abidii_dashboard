const fs = require('fs');
const { chromium } = require('playwright');

const BASE_URL = process.env.ABIDII_DASHBOARD_URL || 'http://127.0.0.1:3000';
const AUTH_PATH = process.env.ABIDII_AUTH_PATH || '/tmp/abidii_ui_auth.json';
const OUT_PATH = process.env.ABIDII_UI_CHECK_OUT || '/tmp/abidii_auth_ui_workflow_check_results.json';

if (!fs.existsSync(AUTH_PATH)) {
  console.error(`Auth seed not found: ${AUTH_PATH}`);
  process.exit(2);
}

const auth = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));

const workflows = [
  {
    id: 'dashboard',
    name: 'Overview Dashboard',
    route: '/dashboard',
    expectedTexts: ['Dashboard', 'Total Users', 'Platform Distribution', 'Monthly User Growth', 'Monthly Subscriber Growth', 'Customer Demographics'],
    expectTable: false,
    expectPagination: false,
  },
  {
    id: 'operations_alerts',
    name: 'Operations Alerts',
    route: '/operations/alerts',
    expectedTexts: ['Alert History', 'Sent At', 'Level', 'Category', 'Message'],
    expectTable: true,
    expectPagination: true,
  },
  {
    id: 'operations_idempotency',
    name: 'Operations Idempotency',
    route: '/operations/idempotency',
    expectedTexts: ['Idempotency Health', 'Total Keys', 'Active Keys', 'Duplicate Attempts', 'Idempotency Performance'],
    expectTable: false,
    expectPagination: false,
  },
  {
    id: 'operations_cron',
    name: 'Operations Cron Jobs',
    route: '/operations/cron-jobs',
    expectedTexts: ['Cron Jobs', 'Scheduled Jobs', 'Recent Executions'],
    expectTable: true,
    expectPagination: false,
  },
  {
    id: 'community_billing_subscriptions',
    name: 'Community Billing Subscriptions',
    route: '/community/billing',
    expectedTexts: ['Billing Operations', 'Active Subscriptions', 'Total Subscriptions', 'Recent Subscription Events', 'Recent Verification Attempts'],
    expectTable: true,
    expectPagination: true,
  },
  {
    id: 'community_billing_events',
    name: 'Community Billing Events',
    route: '/community/billing/events',
    expectedTexts: ['Recent Subscription Events', 'Event Type'],
    expectTable: true,
    expectPagination: true,
  },
  {
    id: 'community_billing_attempts',
    name: 'Community Billing Verification Attempts',
    route: '/community/billing/verification-attempts',
    expectedTexts: ['Recent Verification Attempts', 'Provider'],
    expectTable: true,
    expectPagination: true,
  },
  {
    id: 'content_home',
    name: 'Content Home',
    route: '/content',
    expectedTexts: ['Content', 'Content Library', 'Learning Items', 'Languages', 'Imports'],
    expectTable: false,
    expectPagination: false,
  },
  {
    id: 'content_library',
    name: 'Content Library Hub',
    route: '/content/library',
    expectedTexts: ['Content Library', 'Words', 'Phrases', 'Time Phrases', 'Sentences', 'Proverbs', 'Letters', 'Numbers', 'Games View'],
    expectTable: false,
    expectPagination: false,
  },
  {
    id: 'content_words',
    name: 'Content Words',
    route: '/content/library/words',
    expectedTexts: ['Lexicon Entries', 'Bulk Actions'],
    expectTable: true,
    expectPagination: true,
  },
  {
    id: 'content_phrases',
    name: 'Content Phrases',
    route: '/content/library/phrases',
    expectedTexts: ['Phrases Management', 'Regenerate Selected Audio'],
    expectTable: true,
    expectPagination: true,
  },
  {
    id: 'content_time_phrases',
    name: 'Content Time Phrases',
    route: '/content/library/time-phrases',
    expectedTexts: ['Time Phrases Management', 'Regenerate Selected Audio'],
    expectTable: true,
    expectPagination: true,
  },
  {
    id: 'content_sentences',
    name: 'Content Sentences',
    route: '/content/library/sentences',
    expectedTexts: ['Sentences', 'Search'],
    expectTable: true,
    expectPagination: false,
  },
  {
    id: 'content_proverbs',
    name: 'Content Proverbs',
    route: '/content/library/proverbs',
    expectedTexts: ['Proverbs Management', 'Regenerate Selected Audio'],
    expectTable: true,
    expectPagination: true,
  },
  {
    id: 'content_letters',
    name: 'Content Letters',
    route: '/content/library/letters',
    expectedTexts: ['Letters', 'Manage letters'],
    expectTable: true,
    expectPagination: false,
  },
  {
    id: 'content_numbers',
    name: 'Content Numbers',
    route: '/content/library/numbers',
    expectedTexts: ['Numbers', 'Regenerate Selected Audio'],
    expectTable: true,
    expectPagination: true,
  },
  {
    id: 'content_imports',
    name: 'Content Imports',
    route: '/content/imports',
    expectedTexts: ['Dictionary Import', 'Import Sources'],
    expectTable: true,
    expectPagination: false,
  },
  {
    id: 'content_games_alias',
    name: 'Content Games Alias',
    route: '/content/library/games',
    expectedTexts: ['Games Management'],
    expectTable: true,
    expectPagination: false,
  },
];

async function hasText(page, text) {
  const loc = page.getByText(text, { exact: false }).first();
  try {
    await loc.waitFor({ state: 'visible', timeout: 7000 });
    return true;
  } catch {
    return false;
  }
}

async function tableState(page) {
  const tableCount = await page.locator('table').count();
  if (tableCount > 0) return { ok: true, detail: `Found table elements: ${tableCount}` };

  const emptyHints = [
    /No .* found/i,
    /No data available/i,
    /No entries/i,
    /No records/i,
  ];

  const bodyText = await page.locator('body').innerText();
  const matchedHint = emptyHints.find((rx) => rx.test(bodyText));
  if (matchedHint) return { ok: true, detail: 'No table, but explicit empty-state copy present' };

  return { ok: false, detail: 'No table element and no recognized empty-state copy' };
}

async function paginationState(page) {
  const prevBtn = page.getByRole('button', { name: /^Previous$/i }).first();
  const nextBtn = page.getByRole('button', { name: /^Next$/i }).first();

  if ((await prevBtn.count()) === 0 || (await nextBtn.count()) === 0) {
    return { ok: false, detail: 'Pagination controls (Previous/Next) not found', alignedRight: false, numbered: false, advanced: false };
  }

  const paginationMeta = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const prev = buttons.find((b) => b.textContent?.trim() === 'Previous');
    const next = buttons.find((b) => b.textContent?.trim() === 'Next');
    const numberedButtons = buttons.filter((b) => /^\d+$/.test((b.textContent || '').trim()));

    let rightAlignedByClass = false;
    if (prev) {
      let node = prev.parentElement;
      for (let i = 0; i < 5 && node; i += 1) {
        const cls = node.className || '';
        if (typeof cls === 'string' && (cls.includes('justify-end') || cls.includes('ml-auto'))) {
          rightAlignedByClass = true;
          break;
        }
        node = node.parentElement;
      }
    }

    let rightAlignedByPosition = false;
    if (prev && next) {
      const prevRect = prev.getBoundingClientRect();
      const nextRect = next.getBoundingClientRect();
      const left = Math.min(prevRect.left, nextRect.left);
      rightAlignedByPosition = left > window.innerWidth * 0.5;
    }

    const current = document.querySelector('button[aria-current="page"]')?.textContent?.trim() || null;

    return {
      numberedCount: numberedButtons.length,
      hasCurrent: Boolean(current),
      current,
      alignedRight: rightAlignedByClass || rightAlignedByPosition,
    };
  });

  const before = (await page.locator('button[aria-current="page"]').first().textContent())?.trim() || null;
  const disabled = await nextBtn.isDisabled();

  let advanced = false;
  if (!disabled) {
    await nextBtn.click({ timeout: 7000 });
    await page.waitForTimeout(1200);
    const after = (await page.locator('button[aria-current="page"]').first().textContent())?.trim() || null;
    advanced = Boolean(before && after && before !== after);
  }

  const numbered = paginationMeta.numberedCount > 0 && paginationMeta.hasCurrent;
  const ok = numbered && paginationMeta.alignedRight && (disabled || advanced);

  return {
    ok,
    detail: `numbered=${numbered} alignedRight=${paginationMeta.alignedRight} nextDisabled=${disabled} advanced=${advanced} current=${paginationMeta.current ?? 'n/a'}`,
    alignedRight: paginationMeta.alignedRight,
    numbered,
    advanced,
    nextDisabled: disabled,
  };
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const context = await browser.newContext({ viewport: { width: 1536, height: 960 } });

  await context.addInitScript((seed) => {
    sessionStorage.setItem('access_token', seed.access_token);
    sessionStorage.setItem('refresh_token', seed.refresh_token || seed.access_token);
    sessionStorage.setItem('token_expiry', String(Date.now() + 2 * 60 * 60 * 1000));
    sessionStorage.setItem('user', JSON.stringify(seed.user));
    document.cookie = `user=${encodeURIComponent(JSON.stringify(seed.user))}; path=/; SameSite=Strict`;
  }, auth);

  const page = await context.newPage();
  const results = [];

  for (const wf of workflows) {
    const row = {
      id: wf.id,
      name: wf.name,
      route: wf.route,
      status: 'PASS',
      checks: [],
      apiErrors: [],
      consoleErrors: [],
      checkedAt: new Date().toISOString(),
    };

    const apiErrors = [];
    const consoleErrors = [];

    const onResp = (resp) => {
      const url = resp.url();
      if (!url.includes('/api/v1/')) return;
      if (resp.status() >= 400) {
        apiErrors.push(`${resp.status()} ${url}`);
      }
    };
    const onConsole = (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    };

    page.on('response', onResp);
    page.on('console', onConsole);

    try {
      const resp = await page.goto(`${BASE_URL}${wf.route}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForTimeout(2200);

      const statusCode = resp?.status?.() || null;
      row.checks.push({ name: 'route_http_status', ok: statusCode !== null && statusCode < 400, detail: `status=${statusCode}` });
      if (!(statusCode !== null && statusCode < 400)) row.status = 'FAIL';

      const currentPath = new URL(page.url()).pathname;
      const authRedirect = currentPath === '/' || currentPath === '/signin';
      row.checks.push({ name: 'auth_guard', ok: !authRedirect, detail: `landed=${currentPath}` });
      if (authRedirect) row.status = 'FAIL';

      for (const text of wf.expectedTexts) {
        const ok = await hasText(page, text);
        row.checks.push({ name: `text:${text}`, ok, detail: ok ? 'visible' : 'missing' });
        if (!ok) row.status = 'FAIL';
      }

      if (wf.expectTable) {
        const table = await tableState(page);
        row.checks.push({ name: 'table_or_empty_state', ok: table.ok, detail: table.detail });
        if (!table.ok) row.status = 'FAIL';
      }

      if (wf.expectPagination) {
        const pagination = await paginationState(page);
        row.checks.push({ name: 'pagination', ok: pagination.ok, detail: pagination.detail });
        if (!pagination.ok) row.status = 'FAIL';
      }

      row.apiErrors = [...new Set(apiErrors)];
      row.consoleErrors = [...new Set(consoleErrors)];

      const hardApiErrors = row.apiErrors.filter((line) => /\b(401|403|404|409|422|429|500|502|503|504)\b/.test(line));
      row.checks.push({ name: 'api_errors', ok: hardApiErrors.length === 0, detail: hardApiErrors.length ? hardApiErrors.join(' | ') : 'none' });
      if (hardApiErrors.length) row.status = 'FAIL';

      const hardConsoleErrors = row.consoleErrors.filter((line) => {
        const t = line.toLowerCase();
        if (t.includes('failed to load audio source')) return true;
        if (t.includes('typeerror') || t.includes('referenceerror') || t.includes('unhandled')) return true;
        if (t.includes('error')) return true;
        return false;
      });
      row.checks.push({ name: 'console_errors', ok: hardConsoleErrors.length === 0, detail: hardConsoleErrors.length ? hardConsoleErrors.slice(0, 5).join(' | ') : 'none' });
      if (hardConsoleErrors.length) row.status = 'FAIL';
    } catch (err) {
      row.status = 'FAIL';
      row.checks.push({ name: 'exception', ok: false, detail: err?.message || String(err) });
    } finally {
      page.off('response', onResp);
      page.off('console', onConsole);
    }

    results.push(row);
  }

  await browser.close();

  const summary = {
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    total: results.length,
    passed: results.filter((r) => r.status === 'PASS').length,
    failed: results.filter((r) => r.status === 'FAIL').length,
    results,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(summary, null, 2));

  console.log(`TOTAL=${summary.total} PASS=${summary.passed} FAIL=${summary.failed}`);
  for (const r of results) {
    console.log(`${r.status}\t${r.route}\t${r.name}`);
  }
  console.log(`WROTE=${OUT_PATH}`);
})();
