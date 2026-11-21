'use strict';

// The page explorer: the tree of pages in the sidebar, the listing of a page's children, its search, the
// status of a page in the listing, adding a child page of a type, and opening a page in the editor.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./wagtail-helpers');

/** The rows of the explorer's listing: [{ title, href, status, locked, text }]. */
async function explorerRows(page) {
  return page.locator('#listing-results table tbody tr, main table tbody tr').evaluateAll((rows) => rows.map((tr) => {
    const link = tr.querySelector('td a[href*="/edit/"]');
    const status = tr.querySelector('a[href] .w-sr-only, .status-tag, .w-status');
    const statusCell = [...tr.querySelectorAll('td')].find((td) => /Current page status/i.test(td.textContent || ''));
    return {
      title: link ? link.textContent.replace(/\s+/g, ' ').trim() : '',
      href: link ? link.getAttribute('href') : '',
      status: statusCell ? statusCell.textContent.replace(/Current page status:?/i, '').replace(/\s+/g, ' ').trim().toLowerCase() : (status ? status.textContent.trim().toLowerCase() : ''),
      locked: !!tr.querySelector('[title*="locked" i], [aria-label*="locked" i]') || /locked to further editing/i.test(tr.textContent || ''),
      text: (tr.innerText || '').replace(/\s+/g, ' ').trim(),
    };
  }).filter((r) => r.title));
}

/**
 * The home page: the page of the tree whose live address is the site's root ("/"), as the explorer of the tree's
 * root lists it (its admin id, and its title as the admin writes it).
 */
async function homePage(world) {
  const res = await world.page.request.get(h.adminUrl(world, 'pages/'), { failOnStatusCode: false, timeout: h.budget(world) });
  const html = await res.text();
  for (const row of html.split(/<tr[\s>]/).slice(1)) {
    const edit = row.match(/href="[^"]*\/pages\/(\d+)\/edit\/"/);
    if (!edit || !/href="\/"/.test(row.split('</tr>')[0])) continue;
    const title = row.match(new RegExp(`id="page_${edit[1]}_title"[^>]*>([\\s\\S]*?)</span>`));
    return { id: edit[1], title: title ? h.clean(h.decodeEntities(title[1].replace(/<[^>]*>/g, ' '))) : '' };
  }
  throw friendly({ message: 'No page of the tree answers at the site\'s root ("/").', hint: 'The home page is the root page of the site (Settings › Sites): a page of the tree that is live at "/".' });
}

/** The admin id of a page named by its title, or of the home page when no title is given. */
async function pageOrHome(world, title) {
  return title ? h.pageId(world, title) : (await homePage(world)).id;
}

/** Whether the page on screen is a page explorer listing. */
function onExplorer(world) {
  return /\/pages\/\d+\/(?:\?.*)?$/.test(h.pathOf(world, world.page.url()));
}

/**
 * Open the page explorer of a page (the listing of its children), by the page's title, as the admin's page
 * search finds it, or of the home page (the page of the tree that is live at the site's root).
 *
 * Example #1: When I go to the page explorer of "Breads"
 * Example #2: When I go to the page explorer of the home page
 * Example #3: And I go to the page explorer of "Blog"
 * Example #4: When we go to the page explorer of "Recipes"
 * Example #5: When I go to the page explorer of "Locations"
 */
When(/^(?:I|we) go to the page explorer of (?:"([^"]*)"|the home page)$/, async function (title) {
  const id = await pageOrHome(this, title);
  await h.open(this, h.adminUrl(this, `pages/${id}/`));
});

/**
 * Assert that the page explorer on screen lists a page, by its title, or does not.
 *
 * Example #1: Then the page explorer should list "About"
 * Example #2: Then the page explorer should not list "Webship test page"
 * Example #3: And the page explorer should list "Contact Us"
 * Example #4: Then the page explorer should list "Anadama"
 * Example #5: And the page explorer should not list "Breads"
 */
Then(/^the page explorer should( not)* list "([^"]*)"$/, async function (notCase, title) {
  const page = this.page;
  if (!onExplorer(this)) throw friendly({ message: `The page on screen is not a page explorer: ${await h.pageSummary(this)}.`, hint: 'Open it first: When I go to the page explorer of "…"' });
  await h.pageReady(this);
  const rows = await explorerRows(page);
  const has = rows.some((r) => h.normal(r.title) === h.normal(title));
  if (has === !notCase) return;
  throw friendly({
    message: notCase ? `The page explorer lists "${title}".` : `The page explorer does not list "${title}". It lists: ${h.listed(rows.map((r) => r.title))}.`,
    hint: 'The explorer lists the children of one page; a search lists the pages under it that match.',
  });
});

/**
 * Assert how many pages the page explorer counts ("1-7 of 7 pages", "7 pages"): the children of the page, or
 * the results of a search.
 *
 * Example #1: Then the page explorer should count 7 pages
 * Example #2: Then the page explorer should count 11 pages
 * Example #3: And the page explorer should count 1 page
 * Example #4: Then the page explorer should count 4 pages
 * Example #5: Then the page explorer should count 6 pages
 */
Then(/^the page explorer should count (\d+) pages?$/, async function (count) {
  const page = this.page;
  await h.pageReady(this);
  const text = h.clean(await page.locator('main').innerText());
  const m = text.match(/\b\d+-\d+ of (\d+) pages?\b/i) || text.match(/\b(\d+) pages?\b/i);
  const got = m ? parseInt(m[1], 10) : (await explorerRows(page)).length;
  if (got === parseInt(count, 10)) return;
  throw friendly({ message: `The page explorer counts ${got} pages, not ${count}: ${await h.pageSummary(this)}.`, hint: 'The count is the one the listing writes over its titles ("1-7 of 7 pages").' });
});

/**
 * Search the page explorer on screen with its search box: the listing swaps its results in (the pages under
 * the page that match), and the step waits for them.
 *
 * Example #1: When I search the page explorer for "bread"
 * Example #2: When we search the page explorer for "cornbread"
 * Example #3: And I search the page explorer for "Webship test page"
 * Example #4: When I search the page explorer for "Anadama"
 * Example #5: When I search the page explorer for "blog"
 */
When(/^(?:I|we) search the page explorer for "([^"]*)"$/, async function (term) {
  if (!onExplorer(this)) throw friendly({ message: `The page on screen is not a page explorer: ${await h.pageSummary(this)}.`, hint: 'Open it first: When I go to the page explorer of "…"' });
  await h.searchListing(this, term);
});

/**
 * Assert the status the page explorer shows for a page of its listing ("live", "draft", "live + draft",
 * "live + in moderation", "scheduled"), by the page's title.
 *
 * Example #1: Then the page "About" should have the status "live"
 * Example #2: Then the page "Webship test page" should have the status "draft"
 * Example #3: And the page "Webship test page" should have the status "scheduled"
 * Example #4: Then the page "Southern Cornbread" should have the status "live + in moderation"
 * Example #5: Then the page "Webship test page" should have the status "live + draft"
 */
Then(/^the page "([^"]*)" should have the status "([^"]*)"$/, async function (title, status) {
  if (!onExplorer(this)) {
    const found = await h.findPages(this, title);
    const parentRow = found[0];
    if (!parentRow) throw friendly({ message: `No page "${title}" is in the admin's page search.`, hint: 'Name the page by its title.' });
    await h.open(this, h.adminUrl(this, `pages/search/?q=${encodeURIComponent(title)}`));
  }
  const rows = await h.eventually(this, () => explorerRows(this.page), (r) => r.some((x) => h.normal(x.title) === h.normal(title)), async (r) => ({
    message: `The listing does not list "${title}". It lists: ${h.listed(r.map((x) => x.title))}.`,
    hint: 'Open the page explorer of its parent first: When I go to the page explorer of "…"',
  }));
  const row = rows.find((x) => h.normal(x.title) === h.normal(title));
  if (h.normal(row.status) === h.normal(status)) return;
  throw friendly({ message: `The page "${title}" has the status "${row.status}", not "${status}".`, hint: 'The statuses are the explorer\'s: live, draft, live + draft, live + in moderation, scheduled, expired.' });
});

/**
 * Assert that the page explorer shows a page as locked ("This page is locked to further editing"), or not.
 *
 * Example #1: Then the page "Contact Us" should be shown as locked
 * Example #2: Then the page "About" should not be shown as locked
 * Example #3: And the page "Webship test page" should be shown as locked
 * Example #4: Then the page "Webship test page" should not be shown as locked
 * Example #5: Then the page "Contact Us" should be shown as locked
 */
Then(/^the page "([^"]*)" should( not)* be shown as locked$/, async function (title, notCase) {
  const rows = await explorerRows(this.page);
  const row = rows.find((x) => h.normal(x.title) === h.normal(title));
  if (!row) throw friendly({ message: `The listing on screen does not list "${title}". It lists: ${h.listed(rows.map((x) => x.title))}.`, hint: 'Open the page explorer of its parent first: When I go to the page explorer of "…"' });
  if (row.locked === !notCase) return;
  throw friendly({ message: `The page "${title}" is ${row.locked ? '' : 'not '}shown as locked.`, hint: 'A locked page carries "This page is locked to further editing" in the listing.' });
});

/**
 * Open the children of a page of the listing on screen ("Explore child pages of 'Breads'").
 *
 * Example #1: When I explore the child pages of "Breads"
 * Example #2: When we explore the child pages of "Blog"
 * Example #3: And I explore the child pages of "Recipes"
 * Example #4: When I explore the child pages of "Locations"
 * Example #5: When I explore the child pages of "Breads"
 */
When(/^(?:I|we) explore the child pages of "([^"]*)"$/, async function (title) {
  const page = this.page;
  const link = page.getByRole('link', { name: new RegExp(`^Explore child pages of '${h.escapeRegExp(title)}'$`, 'i') }).first();
  if (!(await link.count())) {
    throw friendly({ message: `The listing has no "Explore child pages of '${title}'": ${await h.pageSummary(this)}.`, hint: 'A page without children offers "Add a child page" instead.' });
  }
  await h.afterNavigation(this, () => link.click());
});

/**
 * Add a child page of a type under a page (by its title, or the home page), as a person does: "Add child page"
 * of the parent's explorer, then the type by its name. The step ends on the editor of the new page.
 *
 * Example #1: When I add a "Standard page" under the home page
 * Example #2: When we add a "Blog page" under "Blog"
 * Example #3: And I add a "Bread page" under "Breads"
 * Example #4: When I add a "Recipe page" under "Recipes"
 * Example #5: When I add a "Standard page" under "About"
 */
When(/^(?:I|we) add an? "([^"]*)" under (?:"([^"]*)"|the home page)$/, async function (type, parentTitle) {
  const page = this.page;
  const parent = parentTitle || 'the home page';
  const id = await pageOrHome(this, parentTitle);
  await h.open(this, h.adminUrl(this, `pages/${id}/`));
  const add = page.getByRole('link', { name: /^Add child page$/ }).first();
  if (!(await add.count())) throw friendly({ message: `The page explorer of "${parent}" offers no "Add child page": ${await h.pageSummary(this)}.`, hint: 'The account needs the permission to add pages there.' });
  await h.afterNavigation(this, () => add.click());
  // A parent that allows one type only goes to its editor at once.
  if (/\/pages\/add\//.test(page.url())) return;
  const typeLink = page.locator('main').getByRole('link', { name: h.exactly(type) }).first();
  if (!(await typeLink.count())) {
    const offered = (await page.locator('main li a:not([href*="/usage/"])').allTextContents()).map(h.clean);
    throw friendly({ message: `"${parent}" offers no page type "${type}". It offers: ${h.listed(offered)}.`, hint: 'Which types a page may hold is set by its own type (its subpage types).' });
  }
  await h.afterNavigation(this, () => typeLink.click());
});

/**
 * Assert that a page (by its title, or the home page) offers a type for its child pages (on "Create a page in
 * …"), or does not.
 *
 * Example #1: Then the home page should offer the page type "Standard page"
 * Example #2: Then "Breads" should not offer the page type "Blog page"
 * Example #3: And "Blog" should offer the page type "Blog page"
 * Example #4: Then "Recipes" should offer the page type "Recipe page"
 * Example #5: And "Breads" should offer the page type "Bread page"
 */
Then(/^(?:"([^"]*)"|the home page) should( not)* offer the page type "([^"]*)"$/, async function (parentTitle, notCase, type) {
  const page = this.page;
  const parent = parentTitle || 'the home page';
  const id = await pageOrHome(this, parentTitle);
  await h.open(this, h.adminUrl(this, `pages/${id}/add_subpage/`));
  let offered = [];
  if (/\/pages\/add\/[^/]+\/([^/]+)\//.test(page.url())) {
    offered = [h.clean((await page.title()).replace(/^New:\s*/, '').replace(/\s*-\s*Wagtail$/, ''))];
  } else {
    offered = (await page.locator('main li a:not([href*="/usage/"])').allTextContents()).map(h.clean).filter(Boolean);
  }
  const has = offered.some((t) => h.normal(t) === h.normal(type));
  if (has === !notCase) return;
  throw friendly({ message: notCase ? `"${parent}" offers the page type "${type}".` : `"${parent}" does not offer the page type "${type}". It offers: ${h.listed(offered)}.`, hint: 'Which types a page may hold is set by its own type.' });
});

/**
 * Open a page in the editor, by its title, or the home page.
 *
 * Example #1: When I edit the page "About"
 * Example #2: When we edit the page "Webship test page"
 * Example #3: And I edit the page "Contact Us"
 * Example #4: When I edit the page "Anadama"
 * Example #5: When I edit the home page
 */
When(/^(?:I|we) edit (?:the page "([^"]*)"|the home page)$/, async function (title) {
  const id = await pageOrHome(this, title);
  await h.open(this, h.adminUrl(this, `pages/${id}/edit/`));
});

/** The page explorer of the sidebar ("Pages"), opened: its dialog. */
async function pageTree(world) {
  const page = world.page;
  const dialog = page.getByRole('dialog', { name: 'Page explorer' });
  if (!(await dialog.isVisible().catch(() => false))) {
    if (!h.onAdmin(world) || (await h.loginForm(page).username.count())) await h.open(world, h.adminUrl(world));
    await page.locator('aside').getByRole('button', { name: 'Pages', exact: true }).click();
  }
  await dialog.waitFor({ state: 'visible', timeout: h.budget(world) });
  return dialog;
}

/** The pages the tree shows at its level, once it has loaded them (its items come from the admin's API). */
async function treeTitles(world, dialog) {
  return h.eventually(world, async () => (await dialog.locator('.c-page-explorer__item__title, h3').allTextContents()).map(h.clean).filter(Boolean),
    (titles) => titles.length > 0, async () => ({ message: 'The page tree shows no page.', hint: 'The tree loads the pages of its level from the admin\'s API: is the account allowed to see any?' }));
}

/**
 * Open the page tree of the sidebar ("Pages"): the pages of its first level.
 *
 * Example #1: When I open the page tree
 * Example #2: When we open the page tree
 * Example #3: And I open the page tree
 * Example #4: Given I open the page tree
 * Example #5: When I open the page tree
 */
When(/^(?:I|we) open the page tree$/, async function () {
  const dialog = await pageTree(this);
  await treeTitles(this, dialog);
});

/**
 * Go down the page tree of the sidebar into a page's children ("View child pages of 'Breads'").
 *
 * Example #1: When I open the home page in the page tree
 * Example #2: When we open "Breads" in the page tree
 * Example #3: And I open "Blog" in the page tree
 * Example #4: When I open "Recipes" in the page tree
 * Example #5: When I open "Locations" in the page tree
 */
When(/^(?:I|we) open (?:"([^"]*)"|the home page) in the page tree$/, async function (wanted) {
  const dialog = await pageTree(this);
  const title = wanted || (await homePage(this)).title;
  const before = await treeTitles(this, dialog);
  const link = dialog.getByRole('link', { name: new RegExp(`^View child pages of '${h.escapeRegExp(title)}'$`, 'i') }).first();
  if (!(await link.count())) {
    throw friendly({ message: `The page tree has no children to show for "${title}". It shows: ${h.listed(before)}.`, hint: 'Go down the tree a level at a time, from its first level.' });
  }
  await link.click();
  await h.eventually(this, () => treeTitles(this, dialog), (titles) => titles.join('|') !== before.join('|'), async () => ({ message: `The page tree did not show the children of "${title}".`, hint: 'The tree loads the children from the admin\'s API.' }));
});

/**
 * Assert that the page tree of the sidebar shows a page at the level it is on, or does not.
 *
 * Example #1: Then the page tree should show "Breads"
 * Example #2: Then the page tree should show "Anadama"
 * Example #3: And the page tree should not show "Webship test page"
 * Example #4: Then the page tree should show "Blog"
 * Example #5: And the page tree should show "Contact Us"
 */
Then(/^the page tree should( not)* show "([^"]*)"$/, async function (notCase, title) {
  const dialog = await pageTree(this);
  const titles = await treeTitles(this, dialog);
  const has = titles.some((t) => h.normal(t) === h.normal(title));
  if (has === !notCase) return;
  throw friendly({ message: notCase ? `The page tree shows "${title}".` : `The page tree does not show "${title}". It shows: ${h.listed(titles)}.`, hint: 'The tree shows one level at a time.' });
});
