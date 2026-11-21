'use strict';

// Snippets: the listing of a kind of snippet (found by its name in the sidebar's menus, where a site puts its
// snippets, or in the "Snippets" index), adding one with its fields, what a listing lists and counts, and
// deleting one from its row's menu.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./wagtail-helpers');

/** The address of the listing of a kind of snippet by its name: a link of the sidebar's menus, else the "Snippets" index. */
async function snippetListUrl(world, name) {
  const page = world.page;
  if (!h.onAdmin(world) || (await h.loginForm(page).username.count())) await h.open(world, h.adminUrl(world));
  const fromSidebar = await page.evaluate((wanted) => {
    const found = [];
    const walk = (items) => {
      for (const node of items || []) {
        const args = (node && node._args) || [];
        const item = args[0] || {};
        if ((item.label || '').toLowerCase() === wanted.toLowerCase() && item.url) found.push(item.url);
        if (/SubMenuItem$/.test(node._type || '')) walk(args[1]);
      }
    };
    try {
      const props = JSON.parse(document.querySelector('#wagtail-sidebar-props').textContent);
      const main = props.modules.find((m) => /MainMenuModule$/.test(m._type));
      walk(main._args[0]);
    } catch (e) { /* the index below */ }
    return found[0] || null;
  }, name);
  if (fromSidebar) return h.absolute(world, fromSidebar);
  const res = await page.request.get(h.adminUrl(world, 'snippets/'), { failOnStatusCode: false });
  const html = await res.text();
  for (const m of html.matchAll(/<a[^>]*href="([^"]*\/snippets\/[^"]+\/)"[^>]*>([\s\S]*?)<\/a>/g)) {
    if (h.normal(h.decodeEntities(m[2].replace(/<[^>]*>/g, ' '))) === h.normal(name)) return h.absolute(world, h.decodeEntities(m[1]));
  }
  throw friendly({ message: `No snippets "${name}" are in the sidebar's menus or the snippets index.`, hint: 'Name the snippets by the name the sidebar gives their listing ("Bread types", "People").' });
}

/**
 * Open the listing of a kind of snippet, by the name the sidebar gives it ("Bread types", "People", "Footer
 * text").
 *
 * Example #1: When I go to the "Bread types" snippets
 * Example #2: When I go to the "People" snippets
 * Example #3: And we go to the "Footer text" snippets
 * Example #4: When I go to the "Bread ingredients" snippets
 * Example #5: When I go to the "Bread types" snippets
 */
When(/^(?:I|we) go to the "([^"]*)" snippets$/, async function (name) {
  await h.open(this, await snippetListUrl(this, name));
});

/**
 * Add a snippet of a kind with its fields (a table of two columns: the field, by its label, and its value), as
 * a person does: the listing's "Add …" button, the fields, "Save".
 *
 * Example #1: When I add to the "Bread types" snippets:
 *               | Title | Webship test bread type |
 * Example #2: When we add to the "Bread ingredients" snippets:
 *               | Name | Webship test flour |
 * Example #3: And I add to the "Bread types" snippets:
 *               | Title | Webship test rye |
 * Example #4: When I add to the "Bread types" snippets:
 *               | Title | Webship test bun |
 * Example #5: When we add to the "Bread types" snippets:
 *               | Title | Webship test flatbread |
 */
When(/^(?:I|we) add to the "([^"]*)" snippets:$/, async function (name, table) {
  const page = this.page;
  await h.open(this, await snippetListUrl(this, name));
  const add = page.locator('header, .w-slim-header').getByRole('link', { name: /^Add\b/ }).first();
  if (!(await add.count())) throw friendly({ message: `The "${name}" snippets offer no "Add" button: ${await h.pageSummary(this)}.`, hint: 'The account needs the permission to add them.' });
  await h.afterNavigation(this, () => add.click());
  for (const [field, value] of table.raw()) {
    await h.setField(this, await h.requireField(this, field, page.locator('main')), value);
  }
  await h.footerAction(this, /^\s*(Save|Create)\s*$/);
  const errors = await h.messages(page, 'error');
  if (errors.length) throw friendly({ message: `The snippet was refused: ${h.listed(errors)}; ${h.listed((await h.fieldErrors(page)).map((e) => `${e.label}: ${e.text}`))}.`, hint: 'Fill in every required field.' });
  // "created", or "updated" when the editor's autosave (8.0 and later) made it a moment before.
  await h.expectMessage(this, 'success', /\b(created|updated)\b/i);
});

/**
 * Assert that the listing of a kind of snippet lists one by its title (the first column), or does not.
 *
 * Example #1: Then the "Bread types" snippets should list "Webship test bread type"
 * Example #2: Then the "Bread types" snippets should not list "Webship test bread type"
 * Example #3: And the "People" snippets should list "Roberta Johnson"
 * Example #4: Then the "Bread types" snippets should list "Cornbread"
 * Example #5: Then the "Bread ingredients" snippets should not list "Webship test flour"
 */
Then(/^the "([^"]*)" snippets should( not)* list "([^"]*)"$/, async function (name, notCase, title) {
  await h.open(this, await snippetListUrl(this, name));
  const rows = await h.listingRows(this.page);
  const titles = rows.map((r) => r.title || r.text);
  const has = rows.some((r) => h.normal(r.title) === h.normal(title) || h.mentions(r.text, title));
  if (has === !notCase) return;
  throw friendly({ message: notCase ? `The "${name}" snippets list "${title}".` : `The "${name}" snippets do not list "${title}". They list: ${h.listed(titles.slice(0, 25))}.`, hint: 'A listing shows a page at a time.' });
});

/**
 * Assert how many snippets of a kind there are, as their listing counts them ("17 bread types").
 *
 * Example #1: Then the "Bread types" snippets should count 17
 * Example #2: Then the "People" snippets should count 4
 * Example #3: And the "Bread types" snippets should count 18
 * Example #4: Then the "Footer text" snippets should count 1
 * Example #5: Then the "Bread ingredients" snippets should count 50
 */
Then(/^the "([^"]*)" snippets should count (\d+)$/, async function (name, count) {
  await h.open(this, await snippetListUrl(this, name));
  // The listing writes its count at the end of its pagination ("17 bread types").
  const end = h.clean(await this.page.locator('main nav[aria-label="Pagination"] .pagination__end').first().textContent().catch(() => ''));
  const got = /^\d+/.test(end) ? parseInt(end, 10) : (await h.listingRows(this.page)).length;
  if (got === parseInt(count, 10)) return;
  throw friendly({ message: `The "${name}" snippets count ${got}, not ${count}.`, hint: 'The count is the one the listing writes ("17 bread types").' });
});

/**
 * Delete a snippet from its listing: the row's "More options" menu, "Delete", then "Yes, delete".
 *
 * Example #1: When I delete "Webship test bread type" from the "Bread types" snippets
 * Example #2: When we delete "Webship test flour" from the "Bread ingredients" snippets
 * Example #3: And I delete "Webship test rye" from the "Bread types" snippets
 * Example #4: When I delete "Webship test bun" from the "Bread types" snippets
 * Example #5: When we delete "Webship test flatbread" from the "Bread types" snippets
 */
When(/^(?:I|we) delete "([^"]*)" from the "([^"]*)" snippets$/, async function (title, name) {
  const page = this.page;
  await h.open(this, await snippetListUrl(this, name));
  const toggle = page.getByRole('button', { name: `More options for '${title}'` }).first();
  if (!(await toggle.count())) {
    throw friendly({ message: `The "${name}" snippets do not list "${title}": ${h.listed((await h.listingRows(page)).map((r) => r.title))}.`, hint: 'A snippet is named by its title, as its listing writes it.' });
  }
  await h.chooseFromDropdown(this, toggle, 'Delete');
  await h.confirm(this, /^Yes, delete/);
  await h.expectMessage(this, 'success', 'deleted');
});

/**
 * Make sure a kind of snippet has none of a title: one a run that was stopped half way left (or that the
 * editor's autosave made) is deleted from its listing. The scenario's account needs the permission to delete it.
 *
 * Example #1: Given there is no "Webship test bread type" in the "Bread types" snippets
 * Example #2: Given there is no "Webship test flour" in the "Bread ingredients" snippets
 * Example #3: And there is no "Webship test rye" in the "Bread types" snippets
 * Example #4: Given there is no "Webship test bun" in the "Bread types" snippets
 * Example #5: Given there is no "Webship test flatbread" in the "Bread types" snippets
 */
Given(/^there is no "([^"]*)" in the "([^"]*)" snippets$/, { timeout: 120000 }, async function (title, name) {
  const page = this.page;
  const url = await snippetListUrl(this, name);
  for (let round = 0; round < 5; round += 1) {
    await h.open(this, url);
    const toggle = page.getByRole('button', { name: `More options for '${title}'` }).first();
    if (!(await toggle.count())) return;
    await h.chooseFromDropdown(this, toggle, 'Delete');
    await h.confirm(this, /^Yes, delete/);
    const errors = await h.messages(page, 'error');
    if (errors.length) throw friendly({ message: `"${title}" could not be deleted: ${h.listed(errors)}.`, hint: 'The scenario\'s account needs the permission to delete it; log in as an administrator for the clean-up.' });
  }
});
