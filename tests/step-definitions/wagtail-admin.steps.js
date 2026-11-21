'use strict';

// The admin around the content: the dashboard and its panels, the site summary, the sidebar's menus, the
// messages at the top of a page, and the admin's own search.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./wagtail-helpers');

/** The panels of the dashboard: [{ name, rows: [text], titles: [text] }]. */
async function dashboardPanels(page) {
  return page.locator('main section.w-panel, main [role="region"]').evaluateAll((sections) => sections.map((s) => {
    const heading = s.querySelector('h2');
    return {
      name: heading ? heading.textContent.replace(/\s+/g, ' ').trim() : (s.getAttribute('aria-label') || ''),
      rows: [...s.querySelectorAll('tbody tr')].map((tr) => tr.innerText.replace(/\s+/g, ' ').trim()),
      titles: [...s.querySelectorAll('tbody tr td:first-child a')].map((a) => a.textContent.replace(/\s+/g, ' ').trim()),
    };
  }).filter((p) => p.name));
}

/** Open the dashboard when the page on screen is another one. */
async function onDashboard(world) {
  if (h.pathOf(world, world.page.url()).split('?')[0] !== h.adminPath(world)) await h.open(world, h.adminUrl(world));
}

/**
 * Open the dashboard of the admin (its home page).
 *
 * Example #1: Given I am on the dashboard
 * Example #2: When I go to the dashboard
 * Example #3: Given we are on the dashboard
 * Example #4: When we go to the dashboard
 * Example #5: And I go to the dashboard
 */
Given(/^(?:I am on|we are on|I go to|we go to) the dashboard$/, async function () {
  await h.open(this, h.adminUrl(this));
  if ((await h.loginForm(this.page).username.count()) > 0) {
    throw friendly({ message: 'The dashboard sent the browser to the login page: nobody is logged in.', hint: 'Log in first: Given I am a logged in user with the "editor" user' });
  }
});

/**
 * Assert that the dashboard shows a panel (or does not), by its heading: "Awaiting your review", "Your pages
 * and snippets in a workflow", "Your most recent edits", "Locked pages". Which panels there are depends on the
 * account and on the content. The step opens the dashboard when another page is on screen.
 *
 * Example #1: Then the dashboard should show the panel "Awaiting your review"
 * Example #2: Then the dashboard should not show the panel "Awaiting your review"
 * Example #3: And the dashboard should show the panel "Your most recent edits"
 * Example #4: Then the dashboard should show the panel "Your pages and snippets in a workflow"
 * Example #5: And the dashboard should not show the panel "Your pages and snippets in a workflow"
 */
Then(/^the dashboard should( not)* show the panel "([^"]*)"$/, async function (notCase, name) {
  await onDashboard(this);
  const panels = await dashboardPanels(this.page);
  const has = panels.some((p) => h.normal(p.name) === h.normal(name));
  if (has === !notCase) return;
  throw friendly({
    message: notCase ? `The dashboard shows the panel "${name}".` : `The dashboard has no panel "${name}". Its panels: ${h.listed(panels.map((p) => p.name))}.`,
    hint: 'A panel shows when it has something to list for this account: "Awaiting your review" for a reviewer of a task, a workflow panel for the account that submitted.',
  });
});

/**
 * Assert that a panel of the dashboard lists an item (a page or a snippet), by its title, or does not.
 *
 * Example #1: Then the panel "Awaiting your review" should list "Southern Cornbread"
 * Example #2: Then the panel "Awaiting your review" should not list "Webship test page"
 * Example #3: And the panel "Your pages and snippets in a workflow" should list "Webship test page"
 * Example #4: Then the panel "Your most recent edits" should list "Webship test page"
 * Example #5: And the panel "Awaiting your review" should list "Muddy Waters"
 */
Then(/^the panel "([^"]*)" should( not)* list "([^"]*)"$/, async function (name, notCase, title) {
  await onDashboard(this);
  const panels = await dashboardPanels(this.page);
  const panel = panels.find((p) => h.normal(p.name) === h.normal(name));
  if (!panel) {
    if (notCase) return;
    throw friendly({ message: `The dashboard has no panel "${name}". Its panels: ${h.listed(panels.map((p) => p.name))}.`, hint: 'The panel shows only when it has something to list for this account.' });
  }
  const has = panel.titles.some((t) => h.normal(t) === h.normal(title));
  if (has === !notCase) return;
  throw friendly({
    message: notCase ? `The panel "${name}" lists "${title}".` : `The panel "${name}" does not list "${title}". It lists: ${h.listed(panel.titles)}.`,
    hint: 'A panel lists pages and snippets by their titles.',
  });
});

/**
 * Assert the counts of the site summary on the dashboard ("34 Pages", "39 Images", "2 Documents").
 *
 * Example #1: Then the site summary should count 34 pages
 * Example #2: Then the site summary should count 39 images
 * Example #3: And the site summary should count 2 documents
 * Example #4: Then the site summary should count 1 page
 * Example #5: Then the site summary should count 1 document
 */
Then(/^the site summary should count (\d+) (pages?|images?|documents?)$/, async function (count, kind) {
  await onDashboard(this);
  const items = (await this.page.locator('main .w-summary li, main section.w-summary a').allTextContents()).map(h.clean);
  const wanted = kind.replace(/s$/, '');
  const item = items.find((t) => new RegExp(`^\\d+\\s+${wanted}s?\\b`, 'i').test(t));
  const got = item ? parseInt(item, 10) : null;
  if (got === parseInt(count, 10)) return;
  throw friendly({
    message: got === null ? `The site summary has no count of ${wanted}s. It says: ${h.listed(items)}.` : `The site summary counts ${got} ${wanted}s, not ${count}.`,
    hint: 'The site summary counts what the account may see in its site.',
  });
});

/**
 * The items of the sidebar's menus: [{ menu, name, href }], read from the sidebar's own description of itself
 * (the main menu's items have no menu, the items of a menu name it, the account menu is "account").
 */
async function sidebarItems(page) {
  return page.evaluate(() => {
    const out = [];
    const walk = (items, menu) => {
      for (const node of items || []) {
        const args = (node && node._args) || [];
        const item = args[0] || {};
        out.push({ menu, name: item.label || item.name, href: item.url || item.action || '' });
        if (/SubMenuItem$/.test(node._type || '')) walk(args[1], item.label || item.name);
      }
    };
    const script = document.querySelector('#wagtail-sidebar-props');
    try {
      const props = JSON.parse(script.textContent);
      const main = props.modules.find((m) => /MainMenuModule$/.test(m._type));
      walk(main._args[0], '');
      walk(main._args[1], 'account');
    } catch (e) {
      for (const a of document.querySelectorAll('aside a[href]')) out.push({ menu: '', name: (a.textContent || '').replace(/\s+/g, ' ').trim(), href: a.getAttribute('href') });
    }
    return out;
  });
}

/**
 * Open an item of a menu of the sidebar ("Bread types" in "Breads", "Users" in "Settings", "Locked pages" in
 * "Reports"), as a person does: the menu, then its item.
 *
 * Example #1: When I open "Bread types" from the "Breads" menu
 * Example #2: When I open "Users" from the "Settings" menu
 * Example #3: And I open "Locked pages" from the "Reports" menu
 * Example #4: When we open "Redirects" from the "Settings" menu
 * Example #5: When I open "People" from the "Bakery Misc" menu
 */
When(/^(?:I|we) open "([^"]*)" from the "([^"]*)" menu$/, async function (item, menu) {
  const page = this.page;
  if (!h.onAdmin(this) || (await h.loginForm(page).username.count())) await h.open(this, h.adminUrl(this));
  const sidebar = page.locator('aside');
  const toggle = sidebar.getByRole('button', { name: h.exactly(menu) }).first();
  if (!(await toggle.count())) {
    const items = await sidebarItems(page);
    throw friendly({ message: `The sidebar has no menu "${menu}". Its menus: ${h.listed([...new Set(items.filter((i) => !i.menu).map((i) => i.name))])}.`, hint: 'Name a menu of the sidebar by its words; which menus there are depends on the account.' });
  }
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  const link = sidebar.getByRole('link', { name: h.exactly(item) }).first();
  await h.eventually(this, () => link.isVisible().catch(() => false), (v) => v, async () => {
    const items = (await sidebarItems(page)).filter((i) => h.normal(i.menu) === h.normal(menu)).map((i) => i.name);
    return { message: `The menu "${menu}" has no item "${item}". It has: ${h.listed(items)}.`, hint: 'The items of a menu depend on the permissions of the account.' };
  }, 5000);
  await h.afterNavigation(this, () => link.click());
});

/**
 * Open an item of the sidebar's main menu that is a link of its own ("Images", "Documents", "Forms"), or the
 * dashboard.
 *
 * Example #1: When I open "Images" from the main menu
 * Example #2: When I open "Documents" from the main menu
 * Example #3: And I open "Forms" from the main menu
 * Example #4: When we open "Dashboard" from the main menu
 * Example #5: When I open "Images" from the main menu
 */
When(/^(?:I|we) open "([^"]*)" from the main menu$/, async function (item) {
  const page = this.page;
  if (!h.onAdmin(this) || (await h.loginForm(page).username.count())) await h.open(this, h.adminUrl(this));
  const link = page.locator('aside').getByRole('link', { name: h.exactly(item) }).first();
  if (!(await link.count()) || !(await link.isVisible())) {
    const items = (await sidebarItems(page)).filter((i) => !i.menu).map((i) => i.name);
    throw friendly({ message: `The main menu has no link "${item}". It has: ${h.listed(items)}.`, hint: 'A menu that opens a list of its own ("Settings", "Reports") is opened with: When I open "Users" from the "Settings" menu' });
  }
  await h.afterNavigation(this, () => link.click());
});

/**
 * Assert that the sidebar's main menu offers an item (a link or a menu), or does not: what an account may use
 * shows there.
 *
 * Example #1: Then the main menu should offer "Settings"
 * Example #2: Then the main menu should not offer "Settings"
 * Example #3: And the main menu should offer "Images"
 * Example #4: Then the main menu should offer "Reports"
 * Example #5: And the main menu should not offer "Forms"
 */
Then(/^the main menu should( not)* offer "([^"]*)"$/, async function (notCase, item) {
  const page = this.page;
  if (!h.onAdmin(this) || (await h.loginForm(page).username.count())) await h.open(this, h.adminUrl(this));
  const items = (await sidebarItems(page)).filter((i) => !i.menu).map((i) => i.name);
  const has = items.some((n) => h.normal(n) === h.normal(item));
  if (has === !notCase) return;
  throw friendly({ message: notCase ? `The main menu offers "${item}".` : `The main menu does not offer "${item}". It offers: ${h.listed(items)}.`, hint: 'The main menu shows what the account may use.' });
});

/**
 * Assert that a menu of the sidebar ("Settings", "Reports", a menu of the site's own) offers an item, or does
 * not: what an account may use shows there.
 *
 * Example #1: Then the "Settings" menu should offer "Users"
 * Example #2: Then the "Settings" menu should not offer "Users"
 * Example #3: And the "Reports" menu should offer "Locked pages"
 * Example #4: Then the "Settings" menu should offer "Redirects"
 * Example #5: And the "Settings" menu should not offer "Groups"
 */
Then(/^the "([^"]*)" menu should( not)* offer "([^"]*)"$/, async function (menu, notCase, item) {
  const page = this.page;
  if (!h.onAdmin(this) || (await h.loginForm(page).username.count())) await h.open(this, h.adminUrl(this));
  const all = await sidebarItems(page);
  const menus = [...new Set(all.filter((i) => !i.menu).map((i) => i.name))];
  if (!menus.some((m) => h.normal(m) === h.normal(menu))) {
    if (notCase) return;
    throw friendly({ message: `The sidebar has no menu "${menu}". Its menus: ${h.listed(menus)}.`, hint: 'A menu the account may not use at all does not show.' });
  }
  const items = all.filter((i) => h.normal(i.menu) === h.normal(menu)).map((i) => i.name);
  const has = items.some((n) => h.normal(n) === h.normal(item));
  if (has === !notCase) return;
  throw friendly({ message: notCase ? `The "${menu}" menu offers "${item}".` : `The "${menu}" menu does not offer "${item}". It offers: ${h.listed(items)}.`, hint: 'The items of a menu depend on the permissions of the account.' });
});

/**
 * Assert a message at the top of the page: the outcome the admin writes after an action, of a kind (success,
 * error, warning) or any kind. A part of the message is enough.
 *
 * Example #1: Then I should see the success message "Page 'Webship test page' has been published."
 * Example #2: Then I should see the error message "Sorry, you do not have permission to access this area."
 * Example #3: And I should see the success message "has been updated"
 * Example #4: Then I should see the warning message "This page is currently awaiting moderation."
 * Example #5: Then I should see the message "You have been successfully logged out."
 */
Then(/^(?:I|we) should see the (?:(success|error|warning) )?message "([^"]*)"$/, async function (kind, expected) {
  await h.expectMessage(this, kind || 'any', expected);
});

/**
 * Search the admin with the search box of the sidebar, as a person does (the page search, with the other
 * searches beside it).
 *
 * Example #1: When I search the admin for "bread"
 * Example #2: When we search the admin for "Anadama"
 * Example #3: And I search the admin for "sourdough"
 * Example #4: When I search the admin for "Webship test page"
 * Example #5: When I search the admin for "cornbread"
 */
When(/^(?:I|we) search the admin for "([^"]*)"$/, async function (term) {
  const page = this.page;
  if (!h.onAdmin(this) || (await h.loginForm(page).username.count())) await h.open(this, h.adminUrl(this));
  const box = page.locator('aside').getByRole('textbox', { name: 'Search' }).first();
  if (!(await box.count())) throw friendly({ message: `The sidebar has no search box: ${await h.pageSummary(this)}.`, hint: 'Log in first: the sidebar shows for a signed-in account.' });
  await box.fill(term);
  await h.afterNavigation(this, () => box.press('Enter'));
});

/**
 * Assert that the admin's page search lists a page by its title, or does not.
 *
 * Example #1: Then the admin search should find the page "Anadama"
 * Example #2: Then the admin search should not find the page "Webship test page"
 * Example #3: And the admin search should find the page "Southern Cornbread"
 * Example #4: Then the admin search should find the page "Bread and Circuses"
 * Example #5: And the admin search should not find the page "Sourdough"
 */
Then(/^the admin search should( not)* find the page "([^"]*)"$/, async function (notCase, title) {
  const rows = await h.listingRows(this.page);
  const has = rows.some((r) => h.normal(r.title) === h.normal(title));
  if (has === !notCase) return;
  throw friendly({
    message: notCase ? `The admin search lists the page "${title}".` : `The admin search does not list the page "${title}". It lists: ${h.listed(rows.map((r) => r.title))}; ${await h.pageSummary(this)}.`,
    hint: 'Search first: When I search the admin for "…". The search finds the pages the account may see.',
  });
});
