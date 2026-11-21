'use strict';

// The site a visitor sees: its search (with the search box of its pages, as a visitor uses it), the results of
// a search, and the quick actions an account of the admin gets on every page of the site (the "user bar":
// "Edit this page", "Go to Wagtail admin", "Add a child page", "Show in Explorer").

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./wagtail-helpers');

/**
 * Search the site with the search box of the page on screen, as a visitor does (the site's own search form:
 * the form of role "search", or the field of type "search"). The step waits for the results page.
 *
 * Example #1: When I search the site for "bread"
 * Example #2: When we search the site for "cornbread"
 * Example #3: And I search the site for "Anadama"
 * Example #4: When I search the site for "zzzznothing"
 * Example #5: When I search the site for "blog"
 */
When(/^(?:I|we) search the site for "([^"]*)"$/, async function (term) {
  const page = this.page;
  if (h.onAdmin(this)) await h.open(this, h.siteRoot(this) + '/');
  const boxes = page.locator('form[role="search"] input:not([type="hidden"]), input[type="search"], form[action*="search"] input[name]:not([type="hidden"])');
  const n = await boxes.count();
  let box = null;
  for (let i = 0; i < n; i += 1) if (await boxes.nth(i).isVisible()) { box = boxes.nth(i); break; }
  if (!box) throw friendly({ message: `The page has no search box a visitor can use: ${await h.pageSummary(this)}.`, hint: 'The step uses the site\'s own search form (a form of role "search", or a field of type "search").' });
  await box.fill(term);
  await h.afterNavigation(this, () => box.press('Enter'));
});

/** The links of the results: the links of the main content, without the ones every page has (its menus). */
async function resultLinks(world) {
  return world.page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const inChrome = (a) => a.closest('nav, header, footer, form, [role="navigation"], [role="search"]');
    return [...main.querySelectorAll('a[href]')].filter((a) => !inChrome(a)).map((a) => (a.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  });
}

/**
 * Assert that the results of a search of the site list a page by (a part of) its title, or do not.
 *
 * Example #1: Then the search results should list "Anadama"
 * Example #2: Then the search results should not list "Webship test page"
 * Example #3: And the search results should list "Bread and Circuses"
 * Example #4: Then the search results should list "Hot Cross Bun"
 * Example #5: Then the search results should not list "Anadama"
 */
Then(/^the search results should( not)* list "([^"]*)"$/, async function (notCase, title) {
  const links = await resultLinks(this);
  const has = links.some((t) => h.mentions(t, title));
  if (has === !notCase) return;
  throw friendly({ message: notCase ? `The search results list "${title}".` : `The search results do not list "${title}". They list: ${h.listed(links)}.`, hint: 'Search first: When I search the site for "…". The results are the links of the page\'s main content.' });
});

/** The user bar of the page on screen (a custom element with its own shadow root, which the locators pierce). */
function userBar(page) {
  return page.locator('wagtail-userbar').first();
}

/**
 * Assert that the page of the site shows the quick actions of an account of the admin (the user bar), or does
 * not: a visitor never gets them.
 *
 * Example #1: Then I should see the quick actions of the admin
 * Example #2: Then I should not see the quick actions of the admin
 * Example #3: And we should see the quick actions of the admin
 * Example #4: Then we should not see the quick actions of the admin
 * Example #5: Then I should see the quick actions of the admin
 */
Then(/^(?:I|we) should( not)* see the quick actions of the admin$/, async function (notCase) {
  const bar = userBar(this.page);
  const shown = (await bar.count()) > 0 && (await bar.locator('#wagtail-userbar-trigger, button[aria-haspopup]').first().count()) > 0;
  if (shown === !notCase) return;
  throw friendly({ message: notCase ? 'The page shows the quick actions of the admin.' : `The page shows no quick actions of the admin: ${await h.pageSummary(this)}.`, hint: 'The quick actions show on the site\'s pages for an account that may use the admin; the site\'s template must include them.' });
});

/**
 * Choose a quick action of the page on screen ("Edit this page", "Go to Wagtail admin", "Add a child page",
 * "Show in Explorer"): the user bar opened, then the action; the step waits for the page it leads to.
 *
 * Example #1: When I choose "Edit this page" from the quick actions
 * Example #2: When I choose "Add a child page" from the quick actions
 * Example #3: And we choose "Edit this page" from the quick actions
 * Example #4: When I choose "Show in Explorer" from the quick actions
 * Example #5: When we choose "Edit this page" from the quick actions
 */
When(/^(?:I|we) choose "([^"]*)" from the quick actions$/, async function (action) {
  const page = this.page;
  const bar = userBar(page);
  if (!(await bar.count())) throw friendly({ message: `The page shows no quick actions: ${await h.pageSummary(this)}.`, hint: 'Log in to the admin first; the quick actions show on the site\'s pages for its accounts.' });
  const trigger = bar.locator('#wagtail-userbar-trigger').first();
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
  const item = bar.getByRole('menuitem', { name: h.exactly(action) }).first();
  await h.eventually(this, () => item.isVisible().catch(() => false), (v) => v, async () => {
    const offered = (await bar.getByRole('menuitem').allTextContents()).map(h.clean);
    return { message: `The quick actions offer no "${action}". They offer: ${h.listed(offered)}.`, hint: 'The actions depend on the page and on the account.' };
  }, 5000);
  await h.afterNavigation(this, () => item.click());
});
