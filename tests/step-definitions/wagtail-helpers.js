'use strict';

// Shared plumbing of the steps: addresses, opening a page and waiting for the
// admin's own scripts, messages, the users registry and the session cache,
// fields found by their labels, the editor's actions, autosave and the
// preview, listings, menus and modals, the mail catcher, and the test content
// a scenario makes.
//
// This file registers no step. The admin draws its pages on the server and
// lets its own scripts (Stimulus controllers) work on them: a listing's search
// swaps its results in (the results are `aria-busy` while the request runs),
// the editor saves a draft by itself after a field changes (the autosave
// indicator says "Saving…", then "Saved"), the preview panel renders again a
// moment after an edit, a dialog or a modal opens over the page. The steps
// wait for those signals, never for a fixed time.

const { request: playwrightRequest } = require('playwright');
const { gotoUrl, friendly } = require('webship-js/tests/step-definitions/webship');

// ---------------------------------------------------------------------------
// Budgets and text
// ---------------------------------------------------------------------------

/** The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least 10 seconds. */
function budget(world) {
  return Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, 10000);
}

/** White space collapsed and trimmed; the invisible marks some texts carry removed. */
function clean(text) {
  return String(text === null || text === undefined ? '' : text).replace(/[\u00ad\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * A text as a comparison sees it: cleaned, in lower case, the typographic quotes
 * and apostrophes (“ ” ‘ ’) the same as the straight ones, a closing colon and a
 * required mark ("Title*") dropped.
 */
function normal(text) {
  return clean(text).replace(/[“”„"]/g, '"').replace(/[‘’‚']/g, "'").replace(/["']/g, "'").replace(/\s*\*$/, '').replace(/\s*:$/, '').toLowerCase();
}

/** Whether a text contains another, as `normal` reads them. */
function mentions(text, part) {
  return normal(text).includes(normal(part));
}

/** A list for an error message: `"a", "b", "c"` or `(none)`. */
function listed(values) {
  const items = [...new Set((values || []).map(clean).filter(Boolean))];
  return items.length ? items.map((item) => `"${item}"`).join(', ') : '(none)';
}

/** Escape a literal string for use in a RegExp. */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A regular expression that matches a whole text as `normal` reads it, letter case aside. */
function exactly(text) {
  return new RegExp(`^\\s*${escapeRegExp(clean(text)).replace(/\\ /g, '\\s+')}\\s*\\*?\\s*$`, 'i');
}

/** The entities the server writes in a page, decoded. */
function decodeEntities(text) {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** An ordinal number of a step ("1", "2") as an index, or a failure. */
function indexOf(number, what) {
  const n = parseInt(number, 10);
  if (!(n >= 1)) throw friendly({ message: `"${number}" is not a ${what} number.`, hint: `Count ${what}s from 1: the first is 1.` });
  return n - 1;
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

/** The site root without a trailing slash. */
function siteRoot(world) {
  return String(world.launchUrl || (world.parameters && world.parameters.launchUrl) || '').replace(/\/+$/, '');
}

/** The path of the admin (`worldParameters.adminPath`, /admin/ by default), with its slashes. */
function adminPath(world) {
  const value = String((world.parameters && world.parameters.adminPath) || '/admin/').trim();
  return '/' + value.replace(/^\/+|\/+$/g, '') + '/';
}

/** An address under the admin: `adminUrl(world, 'login/')`. */
function adminUrl(world, rel = '') {
  return siteRoot(world) + adminPath(world) + String(rel).replace(/^\/+/, '');
}

/** An address of the site from a path the page or a step gave (absolute URLs stay as they are). */
function absolute(world, href) {
  if (/^https?:\/\//.test(href)) return href;
  if (/^\/\//.test(href)) return new URL(siteRoot(world)).protocol + href;
  return siteRoot(world) + (String(href).startsWith('/') ? '' : '/') + href;
}

/** The path of an address of the site, with its query string. */
function pathOf(world, url) {
  try {
    const u = new URL(url, siteRoot(world) + '/');
    return u.pathname + u.search;
  } catch (err) {
    return String(url);
  }
}

/** Whether the page on screen is an admin page (its address is under the admin path). */
function onAdmin(world) {
  return pathOf(world, world.page.url()).startsWith(adminPath(world));
}

// ---------------------------------------------------------------------------
// The request the browser cut, opening a page, waiting
// ---------------------------------------------------------------------------

/**
 * Whether the browser shows its own error page instead of the site's answer:
 * Chromium aborts every request in flight when the network of the machine
 * changes (a container starting or stopping on it). Returns a sentence, or ''.
 */
function cutRequest(world) {
  const url = String((world.page && world.page.url()) || '');
  if (url.startsWith('chrome-error://')) {
    return `the browser shows its own error page (${url}): the request was cut before the site answered`;
  }
  return '';
}

/** The hint of a failure where the browser cut the request. */
const CUT_HINT = 'The request was cut, or the site\'s name did not resolve, because the network of the machine changed (a container starting); nothing is wrong with the scenario. Run it again. On a shared machine, run the suite in the project\'s container (cmd-tools-testing.sh <project> --run in the Webship Workspace), where the network of the host does not reach.';

/** The hint for a failure: the cut request's when the browser cut it, else the one given. */
function hintFor(world, hint) {
  return cutRequest(world) ? CUT_HINT : hint;
}

/**
 * Wait until a page is ready to use: the document has loaded, and on an admin
 * page the admin's scripts have started (its controllers connect when the page
 * loads) and no listing is swapping its results in.
 */
async function pageReady(world, timeout) {
  const page = world.page;
  const limit = timeout || budget(world);
  await page.waitForLoadState('load', { timeout: limit }).catch(() => {});
  await page.waitForFunction(() => {
    if (document.readyState !== 'complete') return false;
    // The admin: its Stimulus application runs, and no swap of a listing is under way.
    if (document.querySelector('script[src*="wagtailadmin/js/"]')) {
      if (!(window.wagtail && window.wagtail.app)) return false;
      if (document.querySelector('[aria-busy="true"]')) return false;
    }
    return true;
  }, null, { timeout: limit }).catch(() => {});
  // An editor takes the first picture of its form a moment after it loads ("watch-edits"): an edit made before
  // that is not an edit to it (no autosave, no warning on leaving). Wait for it, a few seconds at most.
  await page.waitForFunction(() => {
    const form = document.querySelector('form[data-controller~="w-unsaved"]');
    if (!form || !(window.wagtail && window.wagtail.app && window.wagtail.app.getControllerForElementAndIdentifier)) return true;
    const unsaved = window.wagtail.app.getControllerForElementAndIdentifier(form, 'w-unsaved');
    return !unsaved || !!unsaved.initialFormData || !!unsaved.forceValue;
  }, null, { timeout: 3000 }).catch(() => {});
}

/** Accept the browser's "leave this page?" question of an editor with unsaved edits, unless a step of webship-js waits for dialogs. */
async function withLeaveConfirmed(world, fn) {
  const page = world.page;
  if (world._dialogHandler) return fn();
  const handler = (dialog) => {
    if (dialog.type() === 'beforeunload') dialog.accept().catch(() => {});
    else dialog.dismiss().catch(() => {});
  };
  page.on('dialog', handler);
  try {
    return await fn();
  } finally {
    page.off('dialog', handler);
  }
}

/**
 * Open a URL and wait for the page to be ready. A network change on the
 * machine aborts a navigation once now and then: the step goes again, once.
 *
 * @returns {Promise<import('playwright').Response|null>} the answer of the server, when the browser gives it.
 */
async function open(world, url) {
  const page = world.page;
  const go = () => page.goto(url, { waitUntil: 'domcontentloaded' });
  let response = null;
  await withLeaveConfirmed(world, async () => {
    try {
      response = await go();
    } catch (err) {
      if (/ERR_NETWORK_CHANGED|chrome-error:\/\/chromewebdata|ERR_ABORTED|frame was detached/.test(String(err && err.message))) {
        await page.waitForTimeout(500);
        response = await go();
      } else {
        // webship-js's own words for a refused connection or an unknown host.
        await gotoUrl(page, url);
      }
    }
    if (cutRequest(world)) {
      await page.waitForTimeout(500);
      response = await go().catch(() => null);
    }
  });
  await pageReady(world);
  return response;
}

/**
 * Run an action that sends a form or follows a link, and wait for the new
 * page: the browser leaves the page it was on and the new one is ready.
 */
async function afterNavigation(world, fn, { cut = 'fail', timeout } = {}) {
  const page = world.page;
  await withLeaveConfirmed(world, async () => {
    await Promise.all([
      page.waitForNavigation({ timeout: timeout || budget(world) * 2, waitUntil: 'load' }).catch(() => {}),
      fn(),
    ]);
  });
  await pageReady(world);
  if (cut === 'fail' && cutRequest(world)) {
    throw friendly({ message: `The page did not load: ${cutRequest(world)}.`, hint: CUT_HINT });
  }
}

/** The main heading of the page, as a person reads it (the admin keeps its h1 in the header). */
async function heading(page) {
  return clean(await page.locator('main h1, header h1, h1').first().textContent({ timeout: 2000 }).catch(() => ''));
}

/** What the page on screen says about itself, for an error message. */
async function pageSummary(world) {
  const cut = cutRequest(world);
  if (cut) return cut;
  const page = world.page;
  const title = clean(await page.title().catch(() => ''));
  const h1 = await heading(page);
  return `the page shows "${h1 || '(no heading)'}" (title "${title}") at ${pathOf(world, page.url())}`;
}

/** Poll a reading until it satisfies a check, or fail with the last reading. */
async function eventually(world, read, check, explain, timeout) {
  const deadline = Date.now() + (timeout || budget(world));
  let value;
  for (;;) {
    value = await read();
    if (check(value)) return value;
    if (Date.now() > deadline) throw friendly(await explain(value));
    await world.page.waitForTimeout(150);
  }
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** The messages the admin shows at the top of a page (`.messages li`), of one kind or all: success, error, warning, info. */
async function messages(page, kind) {
  const selector = kind && kind !== 'any' ? `.messages li.${kind}` : '.messages li';
  return (await page.locator(selector).allTextContents().catch(() => [])).map(clean).filter(Boolean);
}

/** Wait for a message of a kind that says a text (or matches a pattern), or fail with the messages there are. */
async function expectMessage(world, kind, expected, hint) {
  const says = (m) => (expected instanceof RegExp ? expected.test(clean(m)) : mentions(m, expected));
  return eventually(world, () => messages(world.page, kind), (list) => list.some(says), async (list) => ({
    message: `The page shows no ${kind && kind !== 'any' ? kind + ' ' : ''}message "${expected instanceof RegExp ? expected.source : expected}". Its messages: ${listed(list)}; ${await pageSummary(world)}.`,
    hint: hintFor(world, hint || 'The admin writes the outcome of an action at the top of the next page: a success, a warning or an error.'),
  }));
}

/** The errors a form shows: the message above it and the error of each field, by its label. */
async function fieldErrors(page) {
  return page.evaluate(() => {
    const out = [];
    for (const box of document.querySelectorAll('[data-field-errors], .w-field__errors, .error-message, .help-critical')) {
      const text = (box.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      // The label of the field: in the nearest box around the error that has one (a field's wrapper, its
      // panel's heading).
      let label = '';
      for (let el = box.parentElement; el && el !== document.body; el = el.parentElement) {
        const l = el.querySelector('label, .w-field__label, legend, h2');
        if (l) {
          label = (l.textContent || '').replace(/\s+/g, ' ').replace(/\*\s*$/, '').trim();
          break;
        }
        if (el.matches('form, main')) break;
      }
      out.push({ label, text });
    }
    return out;
  });
}

// ---------------------------------------------------------------------------
// Accounts and sessions
// ---------------------------------------------------------------------------

/**
 * An account of the users registry in cucumber.js (`worldParameters.users`),
 * by the handle a scenario names it with.
 *
 * @returns {{handle: string, username: string, password: string, email: (string|undefined), name: (string|undefined)}}
 */
function resolveUser(world, handle) {
  const users = (world.parameters && world.parameters.users) || {};
  const entry = users[handle];
  if (!entry) {
    throw friendly({
      message: `The user "${handle}" is not in the users registry. Known users: ${Object.keys(users).join(', ') || '(none)'}.`,
      hint: `Add it to worldParameters.users in cucumber.js: users: { ${handle}: { username: '${handle}', password: process.env.${String(handle).toUpperCase()}_PASSWORD, email: '${handle}@example.com' } }. The account itself is made once by the build of the site, never by a feature.`,
    });
  }
  if (!entry.username || !entry.password) {
    throw friendly({
      message: `The user "${handle}" has no ${entry.username ? 'password' : 'user name'} in the users registry.`,
      hint: `Set worldParameters.users.${handle}.username and .password in cucumber.js, from environment variables.`,
    });
  }
  return { handle, username: entry.username, password: entry.password, email: entry.email, name: entry.name };
}

/** A handle of the registry stands for its account; anything else is an email address or a user name as it is. */
function accountOf(world, who) {
  const users = (world.parameters && world.parameters.users) || {};
  if (users[who]) return resolveUser(world, who);
  const handle = Object.keys(users).find((h) => [users[h].username, users[h].email].filter(Boolean).some((v) => String(v).toLowerCase() === String(who).toLowerCase()));
  return handle ? resolveUser(world, handle) : { handle: who, username: who, password: '', email: /@/.test(who) ? who : undefined };
}

/** The email address of a handle of the registry; anything else is an address already. */
function addressOf(world, who) {
  const account = accountOf(world, who);
  if (account.email) return account.email;
  if (/@/.test(who)) return who;
  throw friendly({ message: `The user "${who}" has no email address in the users registry.`, hint: `Set worldParameters.users.${who}.email in cucumber.js.` });
}

// The sessions of the accounts that logged in during this run, by site and
// account: the cookies of the browser after a login through the form.
const SESSIONS = new Map();

function sessionKey(world, username) {
  return `${siteRoot(world)}|${String(username).toLowerCase()}`;
}

function reuseSessions(world) {
  return !(world.parameters && world.parameters.reuseSessions === false);
}

/**
 * Who the admin says is signed in: the email address and the user name its
 * account page shows, read with the cookies of the browser (the page on screen
 * stays as it is). Null when the admin sends the request to its login page.
 *
 * @returns {Promise<{email: string, name: string}|null>}
 */
async function signedInAccount(world) {
  let res;
  try {
    res = await world.page.request.get(adminUrl(world, 'account/'), { failOnStatusCode: false, maxRedirects: 0, timeout: budget(world) });
  } catch (err) {
    return null;
  }
  if (res.status() !== 200) return null;
  const html = await res.text();
  if (/name="password"[^>]*type="password"|type="password"[^>]*name="password"/.test(html) && /login-form|name="username"/.test(html)) return null;
  const email = (html.match(/<input[^>]*type="email"[^>]*value="([^"]*)"/) || html.match(/<input[^>]*value="([^"]*)"[^>]*type="email"/) || [])[1] || '';
  const name = (html.match(/"wagtail\.sidebar\.(?:CustomModule|MainMenuModule)"[\s\S]*?"name":\s*"([^"]*)"\s*,\s*"avatarUrl"/) || [])[1] || '';
  return { email: decodeEntities(email), name: decodeEntities(name) };
}

/** Whether the account the admin says is signed in is the account of the registry asked for. */
function isAccount(found, user) {
  if (!found) return false;
  if (user.email && found.email) return found.email.toLowerCase() === String(user.email).toLowerCase();
  const names = [user.username, user.name].filter(Boolean).map((n) => n.toLowerCase());
  return names.includes(String(found.name).toLowerCase());
}

const LOGIN_HINT = 'The admin login page has the fields "Username" and "Password" and the button "Sign in". Check launchUrl and adminPath in cucumber.js, and that the build of the site made the account and gave it access to the admin.';

/** The login form of the admin, its fields and its button. */
function loginForm(page) {
  const form = page.locator('form.login-form, form[action*="login"]').filter({ has: page.locator('input[name="password"]') }).first();
  return {
    form,
    username: form.locator('input[name="username"]'),
    password: form.locator('input[name="password"]'),
    submit: form.locator('button[type="submit"], input[type="submit"]').first(),
  };
}

/**
 * Fill in and send the admin login form, then read its outcome: whether the
 * admin opened (its dashboard or the page asked for), else the errors the login
 * page shows.
 *
 * @returns {Promise<{ok: boolean, errors: string[], cut: boolean}>}
 */
async function submitLogin(world, username, password, { fresh = true, again = true } = {}) {
  const page = world.page;
  if (fresh) {
    await page.context().clearCookies();
    world.__wagtailSession = null;
    await open(world, adminUrl(world, 'login/'));
  }
  const f = loginForm(page);
  try {
    await f.username.waitFor({ state: 'visible', timeout: budget(world) });
  } catch (err) {
    throw friendly({ message: `The admin login form did not appear: ${await pageSummary(world)}.`, cause: err, hint: hintFor(world, LOGIN_HINT) });
  }
  await f.username.fill(username);
  await f.password.fill(password);
  await afterNavigation(world, () => f.submit.click(), { cut: 'return' });
  if (cutRequest(world)) {
    if (again) return submitLogin(world, username, password, { fresh: true, again: false });
    return { ok: false, errors: [cutRequest(world)], cut: true };
  }
  const stillLogin = (await loginForm(page).username.count()) > 0;
  if (!stillLogin && onAdmin(world)) return { ok: true, errors: [], cut: false };
  const errors = [...(await messages(page, 'error')), ...(await fieldErrors(page)).map((e) => (e.label ? `${e.label}: ` : '') + e.text)];
  return { ok: false, errors, cut: false };
}

/** Take over the session an account opened earlier in this run. */
async function restoreSession(world, user) {
  const key = sessionKey(world, user.username);
  const cookies = SESSIONS.get(key);
  if (!cookies || !reuseSessions(world)) return false;
  const context = world.page.context();
  await context.clearCookies();
  await context.addCookies(cookies);
  const found = await signedInAccount(world);
  if (isAccount(found, user)) {
    world.__wagtailSession = key;
    world.__wagtailUser = user;
    await open(world, adminUrl(world));
    return true;
  }
  SESSIONS.delete(key);
  await context.clearCookies();
  return false;
}

/**
 * Log in as an account of the users registry, by its handle: take over its
 * session when it has one from earlier in the run, else log in through the
 * form and keep the session for the next scenario. The step ends on the
 * dashboard.
 */
async function logInAs(world, handle) {
  const user = resolveUser(world, handle);
  if (await restoreSession(world, user)) return user;
  const outcome = await submitLogin(world, user.username, user.password);
  if (!outcome.ok) {
    throw friendly({
      message: `Could not log in to the admin as "${handle}" (${user.username}): ${listed(outcome.errors)}.`,
      hint: outcome.cut ? CUT_HINT : 'Check the user name and the password of the account in worldParameters.users, and that the build of the site gave the account access to the admin.',
    });
  }
  world.__wagtailUser = user;
  if (reuseSessions(world)) {
    const key = sessionKey(world, user.username);
    SESSIONS.set(key, await world.page.context().cookies());
    world.__wagtailSession = key;
  }
  return user;
}

/** Forget the session of the browser in the session cache (it ended), or every session of an account. */
function forgetSession(world, username) {
  if (username) SESSIONS.delete(sessionKey(world, username));
  if (world.__wagtailSession) SESSIONS.delete(world.__wagtailSession);
  world.__wagtailSession = null;
}

// ---------------------------------------------------------------------------
// Fields, found by their labels
// ---------------------------------------------------------------------------

/** The field an element of the page is the label of: by its `for`, or the control inside the label. */
async function controlOfLabel(page, label) {
  const forId = await label.getAttribute('for').catch(() => null);
  if (forId) {
    const control = page.locator(`[id="${forId.replace(/["\\]/g, '\\$&')}"]`);
    if (await control.count()) return control.first();
  }
  const inner = label.locator('input, select, textarea, [contenteditable="true"]');
  if (await inner.count()) return inner.first();
  return null;
}

/**
 * A field by the words of its label, the way a person reads it: the label's
 * text with its required mark ("Title*") or its colon aside, then the
 * accessible name of a control (aria-label, aria-labelledby), then the name
 * attribute. Inside `scope` when given (a block of a StreamField, a modal, a
 * form). Visible fields first: an editor keeps the fields of its other tabs in
 * the page, hidden.
 */
async function findField(world, name, scope) {
  const page = world.page;
  const root = scope || page.locator('body');
  const pattern = exactly(name);
  const candidates = [];
  const labels = root.locator('label, .w-field__label').filter({ hasText: pattern });
  const n = await labels.count();
  for (let i = 0; i < n; i += 1) {
    const label = labels.nth(i);
    if (!pattern.test(clean(await label.textContent()))) continue;
    const control = await controlOfLabel(page, label);
    if (control) candidates.push(control);
  }
  const byRole = root.getByRole('textbox', { name: pattern }).or(root.getByRole('combobox', { name: pattern })).or(root.getByRole('checkbox', { name: pattern })).or(root.getByRole('spinbutton', { name: pattern }));
  const m = await byRole.count();
  for (let i = 0; i < m; i += 1) candidates.push(byRole.nth(i));
  const byName = root.locator(`[name="${String(name).replace(/["\\]/g, '\\$&')}"]`);
  if (await byName.count()) candidates.push(byName.first());
  for (const c of candidates) {
    if (await c.isVisible().catch(() => false)) return c;
  }
  return candidates[0] || null;
}

/** The labels of the fields in a scope, for an error message. */
async function fieldLabels(page, scope) {
  const root = scope || page.locator('main');
  return (await root.locator('label, .w-field__label').allTextContents().catch(() => [])).map((t) => clean(t).replace(/\*$/, '').trim()).filter(Boolean);
}

/** A field, or a failure that names the fields there are. */
async function requireField(world, name, scope, where = 'on the page') {
  const field = await findField(world, name, scope);
  if (field) return field;
  throw friendly({
    message: `No field "${name}" ${where}. The fields there: ${listed(await fieldLabels(world.page, scope))}.`,
    hint: 'Name the field by its label as the page writes it (the required mark aside). A field on another tab of the editor is found there too.',
  });
}

/** Open the tab of the editor that holds a field, when the field is on a tab that is not shown. */
async function showFieldTab(world, field) {
  const page = world.page;
  const panelId = await field.evaluate((el) => {
    const panel = el.closest('[role="tabpanel"]');
    return panel && panel.hidden ? panel.id : null;
  }).catch(() => null);
  if (!panelId) return;
  const tab = page.locator(`[role="tab"][aria-controls="${panelId}"]`);
  if (await tab.count()) {
    await tab.first().click();
    await eventually(world, () => field.isVisible(), (v) => v, async () => ({ message: `The tab of the field did not open: ${await pageSummary(world)}.`, hint: 'The editor shows one tab at a time; the step opens the tab of the field.' }));
  }
}

/**
 * Set a field the way a person does: type in a text box, choose an option of a
 * select by its words, tick or clear a checkbox ("yes"/"no"), type in a rich
 * text editor; then leave the field, as a person does, so that the page's own
 * scripts react (the slug that follows the title, the autosave).
 */
async function setField(world, field, value) {
  const page = world.page;
  await showFieldTab(world, field);
  const kind = await field.evaluate((el) => {
    if (el.isContentEditable) return 'rich';
    if (el.tagName === 'SELECT') return 'select';
    if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) return 'check';
    if (el.tagName === 'INPUT' && el.type === 'hidden') {
      return el.closest('[data-field-input], .w-field__input') && el.closest('[data-field-input], .w-field__input').querySelector('[contenteditable="true"]') ? 'rich-hidden' : 'hidden';
    }
    return 'text';
  });
  if (kind === 'select') {
    const options = await field.evaluate((el) => [...el.options].map((o) => ({ value: o.value, text: o.textContent.replace(/\s+/g, ' ').replace(/^[\s↳]+/, '').trim() })));
    const option = options.find((o) => normal(o.text) === normal(value)) || options.find((o) => o.value === value);
    if (!option) throw friendly({ message: `The field has no option "${value}". Its options: ${listed(options.map((o) => o.text))}.`, hint: 'Name the option by its words, as the list shows them.' });
    await field.selectOption(option.value);
  } else if (kind === 'check') {
    const on = /^(yes|true|on|checked|1)$/i.test(String(value).trim());
    const label = page.locator(`label[for="${await field.getAttribute('id')}"]`);
    const current = await field.isChecked();
    if (current !== on) {
      await field.click().catch(async () => label.first().click());
    }
  } else if (kind === 'rich' || kind === 'rich-hidden') {
    const editor = kind === 'rich' ? field : field.locator('xpath=ancestor::*[@data-field-input or contains(@class,"w-field__input")][1]').locator('[contenteditable="true"]').first();
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Delete');
    await page.keyboard.type(String(value));
  } else if (kind === 'hidden') {
    throw friendly({ message: 'The field is a hidden one, which a person cannot set.', hint: 'Name the field a person sees: its label on the page.' });
  } else {
    await field.fill(String(value === null || value === undefined ? '' : value));
  }
  // Leave the field: its change event goes out, and the page's own scripts follow.
  await field.evaluate((el) => {
    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (typeof el.blur === 'function') el.blur();
  }).catch(() => {});
  await settleSync(world, field);
}

/** The value a field shows: its text, the words of its chosen option, "yes"/"no" for a checkbox, a rich text's words. */
async function fieldValue(field) {
  return field.evaluate((el) => {
    if (el.isContentEditable) return (el.textContent || '').trim();
    if (el.tagName === 'SELECT') return el.selectedIndex >= 0 ? el.options[el.selectedIndex].textContent.replace(/^[\s↳]+/, '').trim() : '';
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? 'yes' : 'no';
    if (el.type === 'hidden') {
      const box = el.closest('[data-field-input], .w-field__input');
      const rich = box && box.querySelector('[contenteditable="true"]');
      if (rich) return (rich.textContent || '').trim();
    }
    return el.value;
  });
}

/**
 * Wait for what the page does after a field changed: a field that another one
 * follows (the slug follows the title) gets its value a moment later; the
 * editor's autosave starts.
 */
async function settleSync(world, field) {
  const page = world.page;
  const target = await field.evaluate((el) => {
    if (!/(^|\s)w-sync(\s|$)/.test(el.getAttribute('data-controller') || '')) return null;
    return el.getAttribute('data-w-sync-target-value');
  }).catch(() => null);
  if (target) {
    // The sync is debounced: wait until the followed field is not empty (it stays empty when its own value was kept).
    await page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return !el || el.value !== '' || el.getAttribute('data-w-sync-disabled-value') === 'true';
    }, target, { timeout: 3000 }).catch(() => {});
  }
  await autosaveSettled(world);
}

// ---------------------------------------------------------------------------
// The editor: autosave, actions, status, preview
// ---------------------------------------------------------------------------

/** The editor's form (a page, a snippet with drafts): `form[data-edit-form]`, or the main form. */
function editForm(page) {
  return page.locator('form[data-edit-form], form#page-edit-form').first();
}

/**
 * Wait until the editor has no save of its own under way (the editors of 8.0 and later save a draft by
 * themselves a moment after a field changes): its form holds no edit its autosave has not saved yet (the form
 * as its unsaved-edits controller pictured it last), and its indicator does not say "Saving…". A paused
 * autosave (an error to correct first) counts as settled. An editor without autosave returns at once.
 */
async function autosaveSettled(world, timeout) {
  const page = world.page;
  const has = await page.locator('form[data-controller~="w-autosave"]').count().catch(() => 0);
  if (!has) return;
  await page.waitForFunction(() => {
    const form = document.querySelector('form[data-controller~="w-autosave"]');
    if (!form) return true;
    const indicator = document.querySelector('#w-autosave-indicator');
    const state = indicator ? indicator.getAttribute('data-w-autosave-state-value') : null;
    if (state === 'saving') return false;
    if (state === 'paused') return true;
    const app = window.wagtail && window.wagtail.app;
    const unsaved = app && app.getControllerForElementAndIdentifier ? app.getControllerForElementAndIdentifier(form, 'w-unsaved') : null;
    if (!unsaved || !unsaved.initialFormData) return true;
    return unsaved.formData === unsaved.initialFormData;
  }, null, { timeout: timeout || budget(world) }).catch(() => {});
}

/** The footer of the editor's actions ("Save draft", "More actions" and its menu). */
function actionsFooter(page) {
  return page.locator('nav[aria-label="Actions (footer)"], footer.footer, .footer__container').first();
}

/** The "More actions" toggle of the editor's footer. */
function moreActions(page) {
  return actionsFooter(page).locator('[data-w-dropdown-target="toggle"], button').filter({ hasText: /^\s*More actions\s*$/ }).first();
}

/** The names of the actions the footer offers: its buttons, and the items of its "More actions" menu. */
async function footerActions(world) {
  const page = world.page;
  const footer = actionsFooter(page);
  const direct = await footer.locator('button, a').evaluateAll((els) => els.filter((e) => !e.closest('[data-tippy-root]') && e.offsetParent !== null).map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
  let inMenu = [];
  const more = moreActions(page);
  if (await more.count()) {
    const menu = await openDropdown(world, more);
    inMenu = (await menu.locator('a, button').allTextContents()).map(clean).filter(Boolean);
    await closeDropdown(world);
  }
  return [...direct, ...inMenu].filter((n) => n !== 'More actions');
}

/**
 * Choose an action of the editor's footer by its words ("Save draft", "Publish", "Submit to Moderators
 * approval", "Unpublish"): from the footer, or from its "More actions" menu. Waits for the editor to settle
 * first (the autosave), then for the page the action leads to.
 */
async function footerAction(world, name, { navigate = true } = {}) {
  const page = world.page;
  await autosaveSettled(world);
  const footer = actionsFooter(page);
  const label = typeof name === 'string' ? name : name.source;
  if (!(await footer.count())) {
    throw friendly({ message: `There is no editor here to choose "${label}" in: ${await pageSummary(world)}.`, hint: 'Open a page or a snippet in the editor first.' });
  }
  const pattern = typeof name === 'string' ? exactly(name) : name;
  let target = null;
  const direct = footer.locator('button, a').filter({ hasText: pattern });
  for (let i = 0; i < (await direct.count()); i += 1) {
    const candidate = direct.nth(i);
    if (!(await candidate.evaluate((e) => !!e.closest('[data-tippy-root]'))) && (await candidate.isVisible())) { target = candidate; break; }
  }
  if (!target) {
    const more = moreActions(page);
    if (await more.count()) {
      const menu = await openDropdown(world, more);
      const item = menu.locator('a, button').filter({ hasText: pattern }).first();
      if (await item.count()) target = item;
      else await closeDropdown(world);
    }
  }
  if (!target) {
    throw friendly({
      message: `The editor offers no action "${label}". It offers: ${listed(await footerActions(world))}.`,
      hint: 'The actions depend on the account (an editor submits for moderation, a moderator publishes) and on the state of the page (Unpublish only for a live page).',
    });
  }
  if (await target.isDisabled().catch(() => false)) {
    throw friendly({ message: `The action "${clean(await target.textContent())}" is disabled: ${listed(await messages(page))}.`, hint: 'A locked page or a page in moderation cannot be changed by this account.' });
  }
  if (navigate) await afterNavigation(world, () => target.click());
  else await target.click();
}

/** The status side panel of the editor, opened. */
async function statusPanel(world) {
  const page = world.page;
  const panel = page.locator('[data-side-panel="status"]');
  if (!(await panel.count())) throw friendly({ message: `The editor has no status panel here: ${await pageSummary(world)}.`, hint: 'Open a page or a snippet with drafts in the editor first.' });
  if (!(await panel.isVisible())) {
    const toggle = page.getByRole('button', { name: 'Toggle status' });
    await toggle.click();
    await panel.waitFor({ state: 'visible', timeout: budget(world) });
  }
  return panel;
}

/** What the status panel says, by its sections: { status: ["Live", "Draft"], locking: ["Unlocked"], … } and the help lines. */
async function statusOf(world) {
  const panel = await statusPanel(world);
  return panel.evaluate((root) => {
    const out = { sections: {}, help: [] };
    for (const h3 of root.querySelectorAll('h3')) {
      if (h3.closest('.w-hidden') || h3.closest('[hidden]')) continue;
      const sr = h3.querySelector('.w-sr-only');
      const label = sr ? sr.textContent.replace(/[\s:]+$/, '').trim().toLowerCase() : (h3.textContent || '').trim().toLowerCase();
      const value = (h3.textContent || '').replace(sr ? sr.textContent : '', '').replace(/\s+/g, ' ').trim();
      (out.sections[label] = out.sections[label] || []).push(value);
    }
    for (const help of root.querySelectorAll('.w-help-text, .w-label-3')) {
      if (help.closest('.w-hidden') || help.closest('[hidden]')) continue;
      const text = (help.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) out.help.push(text);
    }
    return out;
  });
}

/** The preview side panel opened, and its frame. */
async function previewPanel(world) {
  const page = world.page;
  const panel = page.locator('[data-side-panel="preview"]');
  if (!(await panel.count())) throw friendly({ message: `The editor has no preview here: ${await pageSummary(world)}.`, hint: 'Open a page or a snippet with a preview in the editor first.' });
  if (!(await panel.isVisible())) {
    await page.getByRole('button', { name: 'Toggle preview' }).click();
    await panel.waitFor({ state: 'visible', timeout: budget(world) });
  }
  return panel;
}

/** The text the preview shows, once it is not loading and not out of date; '' while it renders. */
async function previewText(world) {
  const page = world.page;
  const state = await page.evaluate(() => {
    const p = document.querySelector('[data-controller~="w-preview"]');
    const spinner = document.querySelector('[data-w-preview-target="spinner"]');
    return {
      stale: p ? p.getAttribute('data-w-preview-stale-value') === 'true' : false,
      loading: spinner ? !spinner.hidden : false,
    };
  }).catch(() => ({ stale: false, loading: false }));
  if (state.loading) return '';
  const frame = page.frameLocator('iframe#w-preview-iframe, [data-side-panel="preview"] iframe').first();
  return clean(await frame.locator('body').innerText({ timeout: 2000 }).catch(() => ''));
}

// ---------------------------------------------------------------------------
// Menus, dropdowns, modals, listings
// ---------------------------------------------------------------------------

/**
 * Open a dropdown by its toggle and return its menu once it is shown: the dropdown's tippy root no longer
 * hidden, its box in the "visible" state (its fade-in done), so a click lands on an item and not on the page
 * under a menu that is still appearing.
 */
async function openDropdown(world, toggle) {
  const page = world.page;
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  const menu = page.locator('[data-tippy-root]:not([hidden])').filter({ has: page.locator('.tippy-box[data-state="visible"]') }).filter({ has: page.locator('a, button') }).last();
  await menu.waitFor({ state: 'visible', timeout: budget(world) });
  // The fade-in of the menu (its transition) ends before an item takes a click.
  await menu.locator('.tippy-box').first().evaluate((box) => new Promise((resolve) => {
    const done = () => resolve();
    const running = box.getAnimations ? box.getAnimations({ subtree: true }).filter((a) => a.playState === 'running') : [];
    if (!running.length) return done();
    Promise.all(running.map((a) => a.finished)).then(done, done);
    setTimeout(done, 1000);
  })).catch(() => {});
  return menu;
}

/** Close the dropdown that is open (Escape), and wait for its menu to go. */
async function closeDropdown(world) {
  const page = world.page;
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('[data-tippy-root]:not([hidden]) .tippy-box[data-state="visible"]').first().waitFor({ state: 'detached', timeout: 2000 }).catch(() => {});
}

/** Open a dropdown (a "More options" or an "Actions" button) and choose an item of it by its words. */
async function chooseFromDropdown(world, toggle, item, { navigate = true } = {}) {
  const menu = await openDropdown(world, toggle);
  const entry = menu.locator('a, button').filter({ hasText: exactly(item) }).first();
  if (!(await entry.count())) {
    const offered = (await menu.locator('a, button').allTextContents()).map(clean);
    await closeDropdown(world);
    throw friendly({ message: `The menu offers no "${item}". It offers: ${listed(offered)}.`, hint: 'The items of a menu depend on the account and on the state of the object.' });
  }
  if (navigate) await afterNavigation(world, () => entry.click());
  else await entry.click();
}

/** The header "Actions" dropdown of an admin page (Delete, Copy, Move, History, …). */
async function headerAction(world, item) {
  const page = world.page;
  const toggle = page.locator('header, .w-slim-header').getByRole('button', { name: 'Actions', exact: true }).first();
  if (!(await toggle.count())) throw friendly({ message: `This page has no "Actions" menu in its header: ${await pageSummary(world)}.`, hint: 'Open the object (a page, an image, a document, a snippet) first.' });
  await chooseFromDropdown(world, toggle, item);
}

/** Confirm a deletion, an unpublishing: the button that starts with "Yes" (or "Delete") of a confirmation page. */
async function confirm(world, words) {
  const page = world.page;
  const button = page.locator('main').getByRole('button', { name: words || /^(Yes\b|Delete$)/ }).first();
  await eventually(world, () => button.count(), (n) => n > 0, async () => ({
    message: `There is no confirmation to accept here: ${await pageSummary(world)}.`,
    hint: 'A deletion asks "Are you sure …?" on a page of its own, with "Yes, delete" and "No, don\'t delete".',
  }));
  await afterNavigation(world, () => button.click());
}

/** The modal open over the page (a chooser, a comment for a workflow action), once it is shown. */
async function openModal(world, name) {
  const page = world.page;
  const modal = page.locator('.modal[role="dialog"], [role="dialog"][aria-modal="true"]').filter({ hasText: name ? new RegExp(escapeRegExp(clean(name)), 'i') : /./ });
  await eventually(world, async () => {
    const n = await modal.count();
    for (let i = n - 1; i >= 0; i -= 1) if (await modal.nth(i).isVisible()) return modal.nth(i);
    return null;
  }, (m) => !!m, async () => ({ message: `No dialog${name ? ` "${name}"` : ''} opened: ${await pageSummary(world)}.`, hint: 'The dialog loads from the site: wait for it after the button that opens it.' }));
  const n = await modal.count();
  for (let i = n - 1; i >= 0; i -= 1) if (await modal.nth(i).isVisible()) return modal.nth(i);
  return modal.first();
}

/**
 * The rows of the listing table of an admin page, as texts, with the main link
 * of each (the title that opens the object).
 *
 * @returns {Promise<Array<{text: string, title: string, href: string}>>}
 */
async function listingRows(page, scope) {
  const root = scope || page.locator('main');
  return root.locator('table tbody tr').evaluateAll((rows) => rows.map((tr) => {
    const link = tr.querySelector('td a[href]:not([href^="#"])');
    return {
      text: (tr.innerText || '').replace(/\s+/g, ' ').trim(),
      title: link ? (link.textContent || '').replace(/\s+/g, ' ').trim() : '',
      href: link ? link.getAttribute('href') : '',
    };
  }));
}

/** The titles of an image listing (a grid of figures). */
async function imageTitles(page) {
  return page.locator('main a.image-choice, main [data-listing] figcaption, main figcaption').evaluateAll((els) => [...new Set(els.map((e) => (e.getAttribute('title') || e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))]);
}

/**
 * Search a listing with its own search box (it swaps its results in) and wait
 * for the answer: the results are not busy and the address carries the term.
 */
async function searchListing(world, term) {
  const page = world.page;
  const box = page.locator('main form[role="search"] input[name="q"], header form[role="search"] input[name="q"], form[data-search-form] input[name="q"], main input[name="q"]').first();
  if (!(await box.count())) throw friendly({ message: `This page has no search box: ${await pageSummary(world)}.`, hint: 'Open a listing first (pages, images, documents, snippets, users).' });
  const swaps = await box.evaluate((el) => !!el.closest('[data-controller~="w-swap"]'));
  if (swaps) {
    await box.fill(term);
    await eventually(world, () => page.evaluate((q) => {
      const url = new URL(location.href);
      const busy = document.querySelector('[aria-busy="true"], [data-w-swap-loading-value="true"]');
      return !busy && (url.searchParams.get('q') || '') === q;
    }, term), (ok) => ok, async () => ({ message: `The search for "${term}" did not finish: ${await pageSummary(world)}.`, hint: 'The listing swaps its results in when the search box changes; its address then carries ?q=.' }));
    await pageReady(world);
  } else {
    await box.fill(term);
    await afterNavigation(world, () => box.press('Enter'));
  }
}

// ---------------------------------------------------------------------------
// Objects of the admin, found by their titles
// ---------------------------------------------------------------------------

/**
 * The pages whose title is a text, found with the admin's page search (the
 * same search a person types in the sidebar): [{ id, title, parent, href }].
 */
async function findPages(world, title) {
  const res = await world.page.request.get(adminUrl(world, `pages/search/?q=${encodeURIComponent(title)}`), { failOnStatusCode: false, timeout: budget(world) });
  const html = await res.text();
  const found = [];
  const rows = html.match(/<tr[\s\S]*?<\/tr>/g) || [];
  for (const row of rows) {
    const link = row.match(/<a[^>]*href="([^"]*\/pages\/(\d+)\/edit\/)"[^>]*>([\s\S]*?)<\/a>/);
    if (!link) continue;
    const text = clean(decodeEntities(link[3].replace(/<[^>]*>/g, ' ')));
    if (normal(text) !== normal(title)) continue;
    const parent = (row.match(/<a[^>]*href="[^"]*\/pages\/(\d+)\/"[^>]*>([\s\S]*?)<\/a>/) || []);
    found.push({ id: link[2], title: text, href: decodeEntities(link[1]), parent: parent[2] ? clean(decodeEntities(parent[2].replace(/<[^>]*>/g, ' '))) : '' });
  }
  return found;
}

/** The admin id of the one page with a title, or a failure that says what was found. */
async function pageId(world, title) {
  const found = await findPages(world, title);
  if (found.length === 1) return found[0].id;
  if (!found.length) {
    throw friendly({ message: `No page "${title}" is in the admin's page search.`, hint: 'Name the page by its title, as the page explorer lists it. A page the account may not see is not found either.' });
  }
  throw friendly({ message: `${found.length} pages are titled "${title}" (under ${listed(found.map((f) => f.parent))}).`, hint: 'Give the page a title of its own in the test content.' });
}

/** The page being edited: its admin id, from the address of the editor. */
function editedPageId(world) {
  const m = pathOf(world, world.page.url()).match(/\/pages\/(\d+)\//);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// The mailbox: the mail catcher of the site (Mailpit)
// ---------------------------------------------------------------------------

/** The address of the mail catcher (`worldParameters.mailUrl`), without a trailing slash. */
function mailUrl(world) {
  const url = world.parameters && world.parameters.mailUrl;
  if (!url) throw friendly({ message: 'No mailbox is configured.', hint: 'Set worldParameters.mailUrl in cucumber.js to the mail catcher (Mailpit) the site sends its mail to, for example https://your-project.ddev.site:8026.' });
  return String(url).replace(/\/+$/, '');
}

let MAIL_CONTEXT = null;

/** A request context of its own for the mail catcher, which takes the local certificate of the site. */
async function mailContext() {
  if (!MAIL_CONTEXT) MAIL_CONTEXT = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
  return MAIL_CONTEXT;
}

/** The messages of the mailbox to an address, newest first, as Mailpit lists them: [{ ID, Subject, Created, To }]. */
async function mailTo(world, address) {
  const ctx = await mailContext();
  let res;
  try {
    res = await ctx.get(`${mailUrl(world)}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}&limit=50`, { failOnStatusCode: false });
  } catch (err) {
    throw friendly({ message: `The mail catcher at ${mailUrl(world)} did not answer.`, cause: err, hint: 'Check worldParameters.mailUrl in cucumber.js and that the mail catcher runs (ddev describe lists it).' });
  }
  if (res.status() !== 200) throw friendly({ message: `The mail catcher at ${mailUrl(world)} answered ${res.status()}.`, hint: 'Check worldParameters.mailUrl in cucumber.js and that the mail catcher runs (ddev describe lists it).' });
  const json = await res.json();
  return (json.messages || []).filter((m) => (m.To || []).some((t) => String(t.Address).toLowerCase() === String(address).toLowerCase()));
}

/** One message of the mailbox, whole: { Subject, Text, HTML, To, From }. */
async function mailMessage(world, id) {
  const ctx = await mailContext();
  return (await ctx.get(`${mailUrl(world)}/api/v1/message/${id}`)).json();
}

/** The links of a message: [{ text, href }], from its HTML (the words of the link) or its plain text (the address itself). */
function mailLinks(message) {
  const links = [];
  for (const m of String(message.HTML || '').matchAll(/<a\b[^>]*href=(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    links.push({ text: clean(m[3].replace(/<[^>]+>/g, ' ')), href: decodeEntities(m[2]) });
  }
  if (!links.length) for (const m of String(message.Text || '').matchAll(/https?:\/\/[^\s)"<>]+/g)) links.push({ text: m[0], href: m[0] });
  return links;
}

/** The text of a message, plain and HTML, for a reader. */
function mailText(message) {
  return clean(`${message.Text || ''} ${decodeEntities(String(message.HTML || '').replace(/<[^>]+>/g, ' '))}`);
}

// ---------------------------------------------------------------------------
// Test content: what a scenario made, to be taken away again
// ---------------------------------------------------------------------------

/**
 * Note an object a scenario made through the admin (a page, an image, a
 * document, a redirect, a collection, a snippet), by the address of its delete
 * page: an After hook takes it away when the scenario did not.
 */
function madeInScenario(world, kind, title, deleteUrl) {
  world.__wagtailMade = world.__wagtailMade || [];
  world.__wagtailMade.push({ kind, title, deleteUrl });
}

module.exports = {
  budget,
  clean,
  normal,
  mentions,
  listed,
  escapeRegExp,
  exactly,
  decodeEntities,
  indexOf,
  siteRoot,
  adminPath,
  adminUrl,
  absolute,
  pathOf,
  onAdmin,
  cutRequest,
  CUT_HINT,
  hintFor,
  pageReady,
  withLeaveConfirmed,
  open,
  afterNavigation,
  heading,
  pageSummary,
  eventually,
  messages,
  expectMessage,
  fieldErrors,
  resolveUser,
  accountOf,
  addressOf,
  signedInAccount,
  isAccount,
  LOGIN_HINT,
  loginForm,
  submitLogin,
  logInAs,
  forgetSession,
  findField,
  fieldLabels,
  requireField,
  showFieldTab,
  setField,
  fieldValue,
  settleSync,
  editForm,
  autosaveSettled,
  actionsFooter,
  footerActions,
  footerAction,
  openDropdown,
  closeDropdown,
  statusPanel,
  statusOf,
  previewPanel,
  previewText,
  chooseFromDropdown,
  headerAction,
  confirm,
  openModal,
  listingRows,
  imageTitles,
  searchListing,
  findPages,
  pageId,
  editedPageId,
  mailUrl,
  mailTo,
  mailMessage,
  mailLinks,
  mailText,
  madeInScenario,
};
