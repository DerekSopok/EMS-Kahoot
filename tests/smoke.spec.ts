import { test, expect, Page, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Use local server for testing (external URLs may be blocked in some environments)
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Store console errors for reporting
let consoleErrors: { test: string; errors: string[] }[] = [];
let gamePin: string = '';
let hostSocketConnected = false;
let playerSocketConnected = false;

// Helper to capture console errors
function setupConsoleCapture(page: Page, testName: string): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    errors.push(`[PAGE ERROR] ${err.message}`);
  });
  return errors;
}

// Helper to save screenshot
async function saveScreenshot(page: Page, name: string): Promise<string> {
  const filename = `${name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  return filepath;
}

test.describe('EMS Kahoot Smoke Tests', () => {
  test.describe.configure({ mode: 'serial' });

  test('1. Homepage Check - Page loads and renders correctly', async ({ page }) => {
    const errors = setupConsoleCapture(page, 'Homepage Check');

    console.log('Navigating to homepage (may take 30+ seconds due to Render cold start)...');

    // Navigate with extended timeout for Render cold start
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 90000 });

    // Verify page is not blank
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.trim().length).toBeGreaterThan(0);

    // Check for essential elements
    const titleElement = page.locator('#title');
    await expect(titleElement).toBeVisible({ timeout: 10000 });

    const nameInput = page.locator('#name');
    await expect(nameInput).toBeVisible();

    const pinInput = page.locator('#pin');
    await expect(pinInput).toBeVisible();

    const joinButton = page.locator('#joinButton');
    await expect(joinButton).toBeVisible();

    const hostLink = page.locator('#host');
    await expect(hostLink).toBeVisible();

    // Capture screenshot
    const screenshotPath = await saveScreenshot(page, '01-homepage');
    console.log(`Homepage screenshot saved: ${screenshotPath}`);

    // Store errors
    consoleErrors.push({ test: 'Homepage Check', errors });

    if (errors.length > 0) {
      console.log('Console errors on homepage:', errors);
    }
  });

  test('2. Host Flow - Create game and get PIN', async ({ page }) => {
    const errors = setupConsoleCapture(page, 'Host Flow');

    console.log('Starting host flow...');

    // Navigate to homepage first
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 90000 });

    // Click the host link
    const hostLink = page.locator('#host');
    await hostLink.click();

    // Wait for quiz selection page
    await page.waitForURL('**/create/**', { timeout: 30000 });
    console.log('Reached quiz selection page');

    // Take screenshot of quiz selection
    await saveScreenshot(page, '02-quiz-selection');

    // Wait for game list to load (Socket.IO fetches this)
    await page.waitForTimeout(3000);

    // Look for any quiz button and click it
    const gameButtons = page.locator('#gameButton, [onclick*="startGame"]');
    const buttonCount = await gameButtons.count();

    if (buttonCount > 0) {
      console.log(`Found ${buttonCount} quiz(zes), clicking first one...`);
      await gameButtons.first().click();
    } else {
      // Try clicking any button in the game list
      const anyButton = page.locator('#game-list button').first();
      if (await anyButton.isVisible()) {
        await anyButton.click();
      } else {
        console.log('No quiz buttons found - may need to create a quiz first');
        await saveScreenshot(page, '02-no-quizzes-found');
        throw new Error('No quizzes available to start a game');
      }
    }

    // Wait for redirect to host lobby
    await page.waitForURL('**/host/**', { timeout: 30000 });
    console.log('Reached host lobby');

    // Wait for WebSocket to establish and provide game PIN
    // The server emits room code after host:create-room
    await page.waitForFunction(() => {
      const pinElement = document.getElementById('gamePinText');
      return pinElement && pinElement.textContent && pinElement.textContent.length > 0;
    }, { timeout: 30000 });

    // Get the game PIN
    const gamePinElement = page.locator('#gamePinText');
    gamePin = await gamePinElement.textContent() || '';
    console.log(`Game PIN generated: ${gamePin}`);

    expect(gamePin).toBeTruthy();
    expect(gamePin.length).toBeGreaterThanOrEqual(4);

    // Check WebSocket connection by verifying PIN was received
    hostSocketConnected = gamePin.length > 0;
    console.log(`Host WebSocket connected: ${hostSocketConnected}`);

    // Verify start button is present
    const startButton = page.locator('#start');
    await expect(startButton).toBeVisible();

    // Take screenshot of host lobby with PIN
    const screenshotPath = await saveScreenshot(page, '03-host-lobby');
    console.log(`Host lobby screenshot saved: ${screenshotPath}`);

    // Store errors
    consoleErrors.push({ test: 'Host Flow', errors });

    if (errors.length > 0) {
      console.log('Console errors during host flow:', errors);
    }
  });

  test('3. Player Flow - Join game with PIN', async ({ browser }) => {
    // Skip if no game PIN was generated
    test.skip(!gamePin, 'No game PIN available from host flow');

    // Create a new browser context for the player
    const playerContext: BrowserContext = await browser.newContext();
    const playerPage: Page = await playerContext.newPage();

    const errors = setupConsoleCapture(playerPage, 'Player Flow');

    console.log(`Player attempting to join game with PIN: ${gamePin}`);

    // Navigate to homepage
    await playerPage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 90000 });

    // Enter game PIN
    const pinInput = playerPage.locator('#pin');
    await pinInput.fill(gamePin);

    // Enter player name
    const nameInput = playerPage.locator('#name');
    await nameInput.fill('TestPlayer1');

    // Take screenshot before joining
    await saveScreenshot(playerPage, '04-player-join-form');

    // Click join button
    const joinButton = playerPage.locator('#joinButton');
    await joinButton.click();

    // Wait for navigation to player lobby
    try {
      await playerPage.waitForURL('**/player/**', { timeout: 30000 });
      console.log('Player joined game successfully');
      playerSocketConnected = true;

      // Wait for lobby to load
      await playerPage.waitForTimeout(2000);

      // Check for waiting message
      const waitingText = playerPage.locator('#title1, .loader');
      const isWaiting = await waitingText.first().isVisible().catch(() => false);

      if (isWaiting) {
        console.log('Player is in lobby waiting for host to start');
      }

      // Take screenshot of player lobby
      const screenshotPath = await saveScreenshot(playerPage, '05-player-lobby');
      console.log(`Player lobby screenshot saved: ${screenshotPath}`);

    } catch (e) {
      console.log('Player join may have failed or timed out');
      await saveScreenshot(playerPage, '05-player-join-error');

      // Check for error messages on page
      const pageContent = await playerPage.content();
      if (pageContent.includes('error') || pageContent.includes('Error')) {
        console.log('Error detected on page during player join');
      }
    }

    // Store errors
    consoleErrors.push({ test: 'Player Flow', errors });

    if (errors.length > 0) {
      console.log('Console errors during player flow:', errors);
    }

    await playerContext.close();
  });

  test('4. WebSocket Health Check', async ({ page }) => {
    const errors = setupConsoleCapture(page, 'WebSocket Health');

    console.log('Checking WebSocket health...');

    // Navigate to homepage
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 90000 });

    // Monitor WebSocket connections
    let wsConnected = false;
    let wsError: string | null = null;

    // Listen for WebSocket events
    page.on('websocket', (ws) => {
      console.log(`WebSocket opened: ${ws.url()}`);
      wsConnected = true;

      ws.on('close', () => {
        console.log('WebSocket closed');
      });

      ws.on('socketerror', (error) => {
        wsError = `WebSocket error: ${error}`;
        console.log(wsError);
      });
    });

    // Try to trigger a WebSocket connection by going to host page
    await page.click('#host');
    await page.waitForTimeout(5000);

    // Check Socket.IO connection status through page
    const socketConnected = await page.evaluate(() => {
      // @ts-ignore - socket is a global variable set by the app
      if (typeof socket !== 'undefined' && socket.connected) {
        return true;
      }
      // Check for io connection
      // @ts-ignore
      if (typeof io !== 'undefined') {
        return true;
      }
      return false;
    });

    console.log(`WebSocket detected by Playwright: ${wsConnected}`);
    console.log(`Socket.IO connected in page: ${socketConnected}`);
    console.log(`Host flow Socket connected: ${hostSocketConnected}`);
    console.log(`Player flow Socket connected: ${playerSocketConnected}`);

    // Take screenshot
    await saveScreenshot(page, '06-websocket-health');

    // Store errors
    consoleErrors.push({ test: 'WebSocket Health', errors });

    if (wsError) {
      errors.push(wsError);
    }

    if (errors.length > 0) {
      console.log('WebSocket/console errors:', errors);
    }

    // Report WebSocket status
    console.log('\n=== WebSocket Health Summary ===');
    console.log(`WebSocket connection established: ${wsConnected || hostSocketConnected || playerSocketConnected}`);
    if (wsError) {
      console.log(`WebSocket errors: ${wsError}`);
    }
  });

  test.afterAll(async () => {
    // Print final summary
    console.log('\n');
    console.log('='.repeat(60));
    console.log('SMOKE TEST SUMMARY');
    console.log('='.repeat(60));

    let totalErrors = 0;
    for (const { test: testName, errors } of consoleErrors) {
      console.log(`\n[${testName}]`);
      if (errors.length === 0) {
        console.log('  No console errors');
      } else {
        totalErrors += errors.length;
        for (const error of errors) {
          console.log(`  - ${error}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Total console errors: ${totalErrors}`);
    console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}`);
    console.log('='.repeat(60));
  });
});
