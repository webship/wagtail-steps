'use strict';

// Redirects: added in Settings › Redirects from an old path to a page (chosen in the page chooser, as a person
// does) or to an address, permanent or temporary; listed; followed by the site; deleted.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./wagtail-helpers');

/** Choose a page in the page chooser dialog that is open: its search, then the page's title. */
async function choosePage(world, title) {
  const modal = await h.openModal(world, 'Choose a page');
  const search = modal.locator('input[name="q"], input[type="text"]').first();
  await search.fill(title);
  const link = modal.locator('table tbody tr td a').filter({ hasText: h.exactly(title) }).first();
  await h.eventually(world, () => link.isVisible().catch(() => false), (v) => v, async () => ({
    message: `The page chooser finds no page "${title}": ${h.listed((await modal.locator('table tbody tr').allTextContents()).map(h.clean))}.`,
    hint: 'The chooser searches the pages by their titles.',
  }));
  await link.click();
  await h.eventually(world, () => modal.isVisible().catch(() => false), (v) => !v, async () => ({ message: 'The page chooser did not close after a page was chosen.', hint: 'Choosing a page closes the chooser.' }), 5000);
}

/**
 * Add a redirect from an old path of the site to a page (chosen in the page chooser) or to an address,
 * temporary or permanent (permanent is the admin's default).
 *
 * Example #1: When I add a temporary redirect from "/webship-test-old-bread" to the page "Breads"
 * Example #2: When I add a permanent redirect from "/webship-test-old-blog" to the page "Blog"
 * Example #3: And we add a permanent redirect from "/webship-test-elsewhere" to "https://example.com/"
 * Example #4: When I add a temporary redirect from "/webship-test-recipes" to the page "Recipes"
 * Example #5: When I add a temporary redirect from "/webship-test-example" to "https://example.org/"
 */
When(/^(?:I|we) add an? (temporary|permanent) redirect from "([^"]*)" to (?:the page "([^"]*)"|"([^"]*)")$/, async function (kind, from, pageTitle, url) {
  const page = this.page;
  await h.open(this, h.adminUrl(this, 'redirects/add/'));
  const main = page.locator('main');
  await h.setField(this, await h.requireField(this, 'Redirect from', main), from);
  await h.setField(this, await h.requireField(this, 'Permanent', main), kind === 'permanent' ? 'yes' : 'no');
  if (pageTitle) {
    await main.getByRole('button', { name: 'Choose a page' }).first().click();
    await choosePage(this, pageTitle);
  } else {
    await h.setField(this, await h.requireField(this, 'Redirect to any URL', main), url);
  }
  await h.afterNavigation(this, () => main.getByRole('button', { name: 'Create' }).click());
  const errors = await h.messages(page, 'error');
  if (errors.length) throw friendly({ message: `The redirect was refused: ${h.listed(errors)}; ${h.listed((await h.fieldErrors(page)).map((e) => `${e.label}: ${e.text}`))}.`, hint: '"Redirect from" takes a path of the site; "Redirect to any URL" a whole address (https://…).' });
  await h.expectMessage(this, 'success', 'added');
});

/** The rows of the redirects list: [{ from, to, type, text }]. */
async function redirectRows(world) {
  await h.open(world, h.adminUrl(world, 'redirects/'));
  return world.page.locator('main table').first().evaluate((table) => {
    const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.replace(/\s+/g, ' ').trim().toLowerCase());
    const col = (name) => heads.findIndex((t) => t.startsWith(name));
    return [...table.querySelectorAll('tbody tr')].map((tr) => {
      const cells = [...tr.querySelectorAll('td')].map((td) => td.innerText.replace(/\s+/g, ' ').trim());
      return { from: cells[col('from')] || '', to: cells[col('to')] || '', type: cells[col('type')] || '', text: cells.join(' | ') };
    });
  }).catch(() => []);
}

/**
 * Assert that the redirects list one from a path (to a page's title or an address, when given), or do not.
 *
 * Example #1: Then the redirects should list "/webship-test-old-bread" to "Breads"
 * Example #2: Then the redirects should not list "/webship-test-old-bread"
 * Example #3: And the redirects should list "/latest" to "Tracking Wild Yeast"
 * Example #4: Then the redirects should list "/github"
 * Example #5: Then the redirects should not list "/webship-test-old-blog"
 */
Then(/^the redirects should( not)* list "([^"]*)"(?: to "([^"]*)")?$/, async function (notCase, from, to) {
  const rows = await redirectRows(this);
  const row = rows.find((r) => h.normal(r.from) === h.normal(from));
  const has = !!row && (!to || h.mentions(row.to, to));
  if (has === !notCase) return;
  throw friendly({
    message: notCase ? `The redirects list "${from}".` : (row ? `The redirect from "${from}" goes to "${row.to}", not "${to}".` : `The redirects do not list "${from}". They list: ${h.listed(rows.map((r) => r.from))}.`),
    hint: 'Settings › Redirects lists each redirect by its old path.',
  });
});

/**
 * Assert how the site answers an old path: a redirect (permanent 301, temporary 302) to a path or an address.
 * The step asks the site itself, without following the redirect.
 *
 * Example #1: Then "/webship-test-old-bread" should redirect to "/breads/"
 * Example #2: Then "/webship-test-old-bread" should redirect temporarily to "/breads/"
 * Example #3: And "/webship-test-old-blog" should redirect permanently to "/blog/"
 * Example #4: Then "/latest" should redirect temporarily to "/blog/tracking-wild-yeast/"
 * Example #5: Then "/breads/baguete" should redirect permanently to "/breads/baguette/"
 */
Then(/^"([^"]*)" should redirect (temporarily |permanently )?to "([^"]*)"$/, async function (from, kind, to) {
  const res = await this.page.request.get(h.absolute(this, from), { maxRedirects: 0, failOnStatusCode: false, timeout: h.budget(this) });
  const status = res.status();
  const location = res.headers().location || '';
  const wantedStatus = kind ? (kind.trim() === 'permanently' ? [301, 308] : [302, 307]) : [301, 302, 307, 308];
  const target = h.pathOf(this, h.absolute(this, location));
  const wantedTarget = /^https?:/.test(to) ? to : h.pathOf(this, h.absolute(this, to));
  const goes = /^https?:/.test(to) ? location === to : target === wantedTarget;
  if (wantedStatus.includes(status) && goes) return;
  throw friendly({
    message: `The site answers "${from}" with ${status}${location ? ` to "${location}"` : ''}, not with a ${kind ? kind.trim() + ' ' : ''}redirect to "${to}".`,
    hint: 'A redirect of Settings › Redirects answers its old path (with or without its closing slash); a path that has a page of its own is never redirected.',
  });
});

/**
 * Delete a redirect by its old path: its page, "Delete" in the header's "Actions", "Yes, delete".
 *
 * Example #1: When I delete the redirect "/webship-test-old-bread"
 * Example #2: When we delete the redirect "/webship-test-old-blog"
 * Example #3: And I delete the redirect "/webship-test-elsewhere"
 * Example #4: When I delete the redirect "/webship-test-recipes"
 * Example #5: When I delete the redirect "/webship-test-example"
 */
When(/^(?:I|we) delete the redirect "([^"]*)"$/, async function (from) {
  const page = this.page;
  await h.open(this, h.adminUrl(this, `redirects/?q=${encodeURIComponent(from)}`));
  const link = page.locator('main table tbody tr td a').filter({ hasText: h.exactly(from) }).first();
  if (!(await link.count())) throw friendly({ message: `There is no redirect from "${from}".`, hint: 'Name the redirect by its old path, as Settings › Redirects lists it.' });
  await h.afterNavigation(this, () => link.click());
  await h.headerAction(this, 'Delete');
  await h.confirm(this, /^Yes, delete/);
  await h.expectMessage(this, 'success', 'deleted');
});
