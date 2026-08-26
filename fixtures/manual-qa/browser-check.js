const fs = require('node:fs');
const { chromium } = require('/root/projects/lumen/node_modules/playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:4178';
const artifactDir = process.env.ARTIFACT_DIR || '/tmp/opencode/p8-validation/artifacts';
fs.mkdirSync(artifactDir, { recursive: true });

async function assertResponsive(page, name, viewport) {
  const metrics = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  if (metrics.scrollWidth > metrics.clientWidth) throw new Error(`${name}/${viewport}: horizontal overflow ${metrics.scrollWidth}>${metrics.clientWidth}`);
  for (const testId of ['sign-out', 'search-input']) {
    const control = page.locator(`[data-testid=${testId}]`);
    if (!await control.isVisible()) throw new Error(`${name}/${viewport}: ${testId} is not visible`);
    const box = await control.boundingBox();
    if (!box || box.width < 42 || box.height < 42) throw new Error(`${name}/${viewport}: ${testId} is not usable`);
  }
}

async function main() {
  const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || chromium.executablePath();
  if (!fs.existsSync(executablePath)) throw new Error(`browser unavailable: ${executablePath}`);
  const browser = await chromium.launch({ headless: true, executablePath });
  const cases = [
    ['primary', '?state=ready&role=editor', 'Rain garden survey'],
    ['empty', '?state=empty', 'No notes yet'],
    ['loading', '?state=loading', 'Loading field notes'],
    ['error', '?state=error', 'Notes could not be loaded'],
    ['authorization-viewer', '?state=unauthorized&role=viewer', 'You do not have access'],
    ['authorization-default', '?state=unauthorized', 'You do not have access'],
    ['authorization-editor', '?state=unauthorized&role=editor', 'You do not have access']
  ];
  const events = [];
  for (const [name, query, expected] of cases) {
    for (const viewport of [{ label: 'desktop', width: 1280, height: 800 }, { label: 'mobile', width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      const consoleErrors = [], failedRequests = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || 'failed'}`));
      await page.goto(`${base}/${query}`);
      await page.locator('[data-testid=status], [data-testid=note-card]').filter({ hasText: expected }).first().waitFor({ state: 'visible' });
      if (name === 'primary') {
        if (await page.locator('[data-testid=note-card]').count() !== 2) throw new Error('primary seed count mismatch');
        await page.locator('[data-testid=search-input]').fill('Rain garden');
        if (await page.locator('[data-testid=note-card]').count() !== 1) throw new Error(`${name}/${viewport.label}: search filter mismatch`);
        if (!(await page.locator('[data-testid=note-card]').first().textContent()).includes('Rain garden survey')) throw new Error(`${name}/${viewport.label}: search result mismatch`);
      }
      if (name.startsWith('authorization')) {
        if (!await page.locator('[data-testid=new-note]').isHidden()) throw new Error(`${name}/${viewport.label}: editor action exposed`);
        if (!await page.locator('[data-testid=search-input]').isDisabled()) throw new Error(`${name}/${viewport.label}: unauthorized search remains active`);
        if (await page.locator('[data-testid=note-card]').count()) throw new Error(`${name}/${viewport.label}: protected notes rendered`);
        if ((await page.locator('body').textContent()).includes('Rain garden survey')) throw new Error(`${name}/${viewport.label}: protected content leaked`);
      }
      await assertResponsive(page, name, viewport.label);
      const screenshot = `${artifactDir}/${name}-${viewport.label}.png`;
      await page.screenshot({ path: screenshot, fullPage: true });
      events.push({ name, viewport: viewport.label, width: viewport.width, expected, consoleErrors, failedRequests, responsive: { noHorizontalOverflow: true, criticalControlsUsable: true }, screenshot });
      await page.close();
    }
  }

  const viewer = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await viewer.goto(`${base}/?state=ready&role=viewer`);
  await viewer.locator('[data-testid=note-card]').first().waitFor({ state: 'visible' });
  const viewerActionHidden = await viewer.locator('[data-testid=new-note]').isHidden();
  if (!viewerActionHidden) throw new Error('viewer can still see editor-only action');
  const viewerActionStatus = await viewer.evaluate(async () => (await fetch('/api/notes/new', { method: 'POST' })).status);
  if (viewerActionStatus !== 403) throw new Error(`viewer editor action returned ${viewerActionStatus}`);
  const viewerScreenshot = `${artifactDir}/authorization-viewer.png`;
  await viewer.screenshot({ path: viewerScreenshot, fullPage: true });
  events.push({ name: 'authorization-viewer-fixed', viewport: 'desktop', width: 1280, expected: 'editor action hidden and server returned 403', consoleErrors: [], failedRequests: [], serverAuthorizationStatus: viewerActionStatus, screenshot: viewerScreenshot });
  await viewer.close();

  const signedOut = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await signedOut.goto(`${base}/?state=ready&role=editor`);
  await signedOut.locator('[data-testid=note-card]').first().waitFor({ state: 'visible' });
  await signedOut.locator('[data-testid=sign-out]').click();
  await signedOut.waitForURL(`${base}/?state=unauthorized`);
  await signedOut.locator('[data-testid=status]').filter({ hasText: 'You do not have access' }).waitFor({ state: 'visible' });
  if (!await signedOut.locator('[data-testid=new-note]').isHidden()) throw new Error('signed-out editor action exposed');
  if (!await signedOut.locator('[data-testid=search-input]').isDisabled()) throw new Error('signed-out search remains active');
  if ((await signedOut.locator('body').textContent()).includes('Rain garden survey')) throw new Error('signed-out protected content leaked');
  const signedOutRetrievalStatus = await signedOut.evaluate(async () => (await fetch('/api/notes')).status);
  const signedOutActionStatus = await signedOut.evaluate(async () => (await fetch('/api/notes/new', { method: 'POST' })).status);
  if (signedOutRetrievalStatus !== 403 || signedOutActionStatus !== 403) throw new Error(`signed-out server authorization returned notes=${signedOutRetrievalStatus}, action=${signedOutActionStatus}`);
  const signedOutScreenshot = `${artifactDir}/authorization-signed-out.png`;
  await signedOut.screenshot({ path: signedOutScreenshot, fullPage: true });
  events.push({ name: 'authorization-signed-out', viewport: 'desktop', width: 1280, expected: 'protected state with server 403 responses', consoleErrors: [], failedRequests: [], serverRetrievalStatus: signedOutRetrievalStatus, serverActionStatus: signedOutActionStatus, screenshot: signedOutScreenshot });
  await signedOut.close();

  if (!events.some(event => event.name === 'error' && event.failedRequests.length > 0)) throw new Error('failed network request was not detected');
  fs.writeFileSync(`${artifactDir}/browser-evidence.json`, JSON.stringify({ base, seed: 'field-notes-v1', events }, null, 2));
  console.log(JSON.stringify({ cases: events.length, screenshots: events.length, networkFailureDetected: true, consoleCaptureInstalled: true, unauthorizedCases: 6, serverAuthorizationChecked: true, responsiveAssertionsChecked: true }));
  await browser.close();
}
main().catch(error => { console.error(error); process.exit(1); });
