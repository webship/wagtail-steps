'use strict';

// Revisions: the history of a page (its log of actions, each revision with its menu), the comparison of two
// revisions field by field, and going back to an earlier revision ("Review this version", then "Replace current
// draft").

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./wagtail-helpers');

/** The entries of a history page, newest first: [{ action, tag, user, text }]. */
async function historyRows(page) {
  return page.locator('main table tbody tr').evaluateAll((rows) => rows.map((tr) => {
    const cells = [...tr.querySelectorAll('td')];
    const first = cells[0] ? cells[0].innerText.replace(/\s+/g, ' ').trim() : '';
    const tag = (tr.querySelector('.w-status, .status-tag, [class*="status"]') || {}).textContent || '';
    return { action: first.replace(tag.trim(), '').trim(), tag: tag.replace(/\s+/g, ' ').trim(), user: cells[1] ? cells[1].innerText.trim() : '', text: tr.innerText.replace(/\s+/g, ' ').trim() };
  }));
}

/**
 * Open the history of a page, by its title, or of the page in the editor ("History" of its header).
 *
 * Example #1: When I open the history of the page "Webship test page"
 * Example #2: When I open the history of the page
 * Example #3: And we open the history of the page "Webship test revisions"
 * Example #4: When we open the history of the page
 * Example #5: When I open the history of the page "About"
 */
When(/^(?:I|we) open the history of the page(?: "([^"]*)")?$/, async function (title) {
  let id = title ? await h.pageId(this, title) : h.editedPageId(this);
  if (!id) throw friendly({ message: `No page is in the editor here: ${await h.pageSummary(this)}.`, hint: 'Name the page: When I open the history of the page "…"' });
  await h.autosaveSettled(this);
  await h.open(this, h.adminUrl(this, `pages/${id}/history/`));
});

/**
 * Assert that the history on screen has an entry of an action ("Created", "Draft saved", "Published",
 * "Unpublished", "Locked", "Reverted to previous revision …"), or does not; a part of the words is enough.
 *
 * Example #1: Then the history should list "Published"
 * Example #2: Then the history should list "Draft saved"
 * Example #3: And the history should list "Reverted to previous revision"
 * Example #4: Then the history should not list "Unpublished"
 * Example #5: Then the history should list "Created"
 */
Then(/^the history should( not)* list "([^"]*)"$/, async function (notCase, action) {
  const rows = await historyRows(this.page);
  const has = rows.some((r) => h.mentions(r.text, action));
  if (has === !notCase) return;
  throw friendly({ message: notCase ? `The history lists "${action}".` : `The history does not list "${action}". It lists: ${h.listed(rows.map((r) => r.text))}.`, hint: 'Open the history first: When I open the history of the page "…"' });
});

/**
 * Assert the newest entry of the history on screen (its action, and its tag: "CURRENT DRAFT", "LIVE VERSION").
 *
 * Example #1: Then the newest entry of the history should be "Draft saved"
 * Example #2: Then the newest entry of the history should be "Published"
 * Example #3: And the newest entry of the history should be "Reverted to previous revision"
 * Example #4: Then the newest entry of the history should be "Unlocked"
 * Example #5: Then the newest entry of the history should be "Locked"
 */
Then(/^the newest entry of the history should be "([^"]*)"$/, async function (action) {
  const rows = await historyRows(this.page);
  if (rows[0] && h.mentions(rows[0].text, action)) return;
  throw friendly({ message: `The newest entry of the history is "${rows[0] ? rows[0].text : '(none)'}", not "${action}".`, hint: 'The history lists the newest entry first.' });
});

/**
 * The row of the history on screen that holds the live version of the page: the revision the newest
 * "Published" entry put live (the entry itself has no menu: the revision is the first row from it down that
 * has one).
 */
async function liveRevisionRow(world) {
  const page = world.page;
  const rows = page.locator('main table tbody tr');
  const n = await rows.count();
  let seenLive = false;
  for (let i = 0; i < n; i += 1) {
    const row = rows.nth(i);
    if (!seenLive) seenLive = /live version/i.test(h.clean(await row.innerText()));
    if (seenLive && (await row.getByRole('button', { name: 'Actions' }).count())) return row;
  }
  throw friendly({
    message: seenLive ? 'The live version of the history has no revision to open.' : `The history on screen has no live version: ${h.listed((await historyRows(page)).map((r) => r.text))}.`,
    hint: 'A page that was published once has a live version; open its history first: When I open the history of the page "…"',
  });
}

/** Open the history of the page in the editor when another page is on screen. */
async function toHistory(world) {
  if (/\/history\//.test(world.page.url())) return;
  const id = h.editedPageId(world);
  if (!id) throw friendly({ message: `No page is in the editor or its history here: ${await h.pageSummary(world)}.`, hint: 'Open the page first: When I edit the page "…"' });
  await h.autosaveSettled(world);
  await h.open(world, h.adminUrl(world, `pages/${id}/history/`));
}

/**
 * Compare two revisions of the page from its history: the current draft with the revision just before it
 * ("Compare with previous version" in the current draft's menu), or the live version with the current draft
 * ("Compare with current version" in the live revision's menu).
 *
 * Example #1: When I compare the live version with the current draft
 * Example #2: When I compare the current draft with the previous version
 * Example #3: And we compare the live version with the current draft
 * Example #4: When we compare the current draft with the previous version
 * Example #5: Then I compare the live version with the current draft
 */
When(/^(?:I|we) compare the (live version with the current draft|current draft with the previous version)$/, async function (which) {
  const page = this.page;
  await toHistory(this);
  if (/^live/.test(which)) {
    const row = await liveRevisionRow(this);
    await h.chooseFromDropdown(this, row.getByRole('button', { name: 'Actions' }), 'Compare with current version');
    return;
  }
  const row = page.locator('main table tbody tr').filter({ hasText: /current draft/i }).first();
  if (!(await row.count())) throw friendly({ message: `The history on screen has no current draft: ${h.listed((await historyRows(page)).map((r) => r.text))}.`, hint: 'A page with a draft newer than its live version has a current draft.' });
  await h.chooseFromDropdown(this, row.getByRole('button', { name: 'Actions' }), 'Compare with previous version');
});

/**
 * Assert a change of a comparison: the field, the words that went and the words that came.
 *
 * Example #1: Then the comparison should show "Introduction" changed from "First" to "Second"
 * Example #2: Then the comparison should show "Title" changed from "Webship test page" to "Webship test page renamed"
 * Example #3: And the comparison should show "Introduction" changed from "First words." to "Second words."
 * Example #4: Then the comparison should show "Title" changed from "renamed" to "page"
 * Example #5: Then the comparison should show "Introduction" changed from "Second" to "First"
 */
Then(/^the comparison should show "([^"]*)" changed from "([^"]*)" to "([^"]*)"$/, async function (field, from, to) {
  const changes = await this.page.locator('main table tbody tr').evaluateAll((rows) => rows.map((tr) => ({
    field: ((tr.querySelector('td.title, td:first-child') || {}).textContent || '').replace(/\s+/g, ' ').replace(/:\s*$/, '').trim(),
    removed: [...tr.querySelectorAll('.deletion')].map((e) => e.textContent).join(' ').replace(/\s+/g, ' ').trim(),
    added: [...tr.querySelectorAll('.addition')].map((e) => e.textContent).join(' ').replace(/\s+/g, ' ').trim(),
  })));
  const row = changes.find((c) => h.normal(c.field) === h.normal(field));
  if (row && h.mentions(row.removed, from) && h.mentions(row.added, to)) return;
  throw friendly({
    message: row ? `The comparison shows "${field}" changed from "${row.removed}" to "${row.added}".` : `The comparison shows no change of "${field}". It shows: ${h.listed(changes.map((c) => c.field))}.`,
    hint: 'The comparison marks the words that went (struck through) and the words that came, field by field.',
  });
});

/**
 * Go back to the live version of the page: "Review this version" of the live revision in the history, then
 * "Replace current draft". The page's draft is the live version again (and it stays live).
 *
 * Example #1: When I revert the page to the live version
 * Example #2: When we revert the page to the live version
 * Example #3: And I revert the page to the live version
 * Example #4: When I revert the page to the live version
 * Example #5: Then I revert the page to the live version
 */
When(/^(?:I|we) revert the page to the live version$/, async function () {
  await toHistory(this);
  const row = await liveRevisionRow(this);
  await h.chooseFromDropdown(this, row.getByRole('button', { name: 'Actions' }), 'Review this version');
  await h.expectMessage(this, 'any', 'previous version', 'The editor opens the old revision with "You are viewing a previous version of this page …".');
  await h.footerAction(this, 'Replace current draft');
  await h.expectMessage(this, 'success', 'has been replaced with version');
});
