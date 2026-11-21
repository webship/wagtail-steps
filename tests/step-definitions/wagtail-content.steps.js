'use strict';

// Test content: what a scenario makes, it takes away. A scenario starts from a site without its test content
// ("Given there is no page …", which removes what a run that was stopped half way left), and what it uploads is
// deleted after it when the scenario did not get to delete it itself. The steps act through the admin as the
// account of the browser, which needs the permission to delete.

const { Given, After } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./wagtail-helpers');

/** Delete what is at a delete page of the admin (its confirmation), when it is still there. */
async function deleteAt(world, url) {
  // Asked first without the browser: a page of an object that is gone answers 404, which the browser would log.
  const probe = await world.page.request.get(url, { failOnStatusCode: false, maxRedirects: 0 }).catch(() => null);
  if (!probe || probe.status() !== 200) return false;
  const response = await h.open(world, url);
  if (response && response.status() === 404) return false;
  const button = world.page.locator('main').getByRole('button', { name: /^(Yes, delete|Delete)\b/ }).first();
  if (!(await button.count())) return false;
  await h.afterNavigation(world, () => button.click());
  return true;
}

/**
 * Make sure the site has no page, image, document, redirect or collection of a title (a redirect by its old
 * path): one a run that was stopped half way left is deleted through the admin. The scenario's account needs
 * the permission to delete it.
 *
 * Example #1: Given there is no page "Webship test page"
 * Example #2: Given there is no image "Webship test loaf"
 * Example #3: And there is no document "Webship test recipe"
 * Example #4: Given there is no redirect "/webship-test-old-bread"
 * Example #5: Given there is no collection "Webship test collection"
 */
Given(/^there is no (page|image|document|redirect|collection) "([^"]*)"$/, { timeout: 120000 }, async function (kind, title) {
  const page = this.page;
  if (!h.onAdmin(this)) await h.open(this, h.adminUrl(this));
  if (await h.loginForm(page).username.count()) {
    throw friendly({ message: `"there is no ${kind}" needs an account of the admin: nobody is logged in.`, hint: 'Log in first: Given I am a logged in user with the "administrator" user' });
  }
  const urls = [];
  if (kind === 'page') {
    for (const p of await h.findPages(this, title)) urls.push(h.adminUrl(this, `pages/${p.id}/delete/`));
  } else {
    const list = { image: 'images/', document: 'documents/', redirect: 'redirects/', collection: 'collections/' }[kind];
    const res = await page.request.get(h.adminUrl(this, `${list}?q=${encodeURIComponent(title)}`), { failOnStatusCode: false });
    const html = await res.text();
    const pattern = {
      image: /<a[^>]*href="[^"]*\/images\/(\d+)\/[^"]*"[^>]*title="([^"]*)"/g,
      document: /<a[^>]*href="[^"]*\/documents\/edit\/(\d+)\/[^"]*"[^>]*>([\s\S]*?)<\/a>/g,
      redirect: /<a[^>]*href="[^"]*\/redirects\/(\d+)\/[^"]*"[^>]*>([\s\S]*?)<\/a>/g,
      collection: /<a[^>]*href="[^"]*\/collections\/(\d+)\/[^"]*"[^>]*>([\s\S]*?)<\/a>/g,
    }[kind];
    for (const m of html.matchAll(pattern)) {
      if (h.normal(h.decodeEntities(m[2].replace(/<[^>]*>/g, ' '))) !== h.normal(title)) continue;
      const del = { image: `images/${m[1]}/delete/`, document: `documents/delete/${m[1]}/`, redirect: `redirects/${m[1]}/delete/`, collection: `collections/${m[1]}/delete/` }[kind];
      urls.push(h.adminUrl(this, del));
    }
  }
  for (const url of [...new Set(urls)]) {
    await deleteAt(this, url);
    const left = (await h.messages(page, 'error'));
    if (left.length) throw friendly({ message: `The ${kind} "${title}" could not be deleted: ${h.listed(left)}.`, hint: 'The scenario\'s account needs the permission to delete it; log in as an administrator for the clean-up.' });
  }
});

/** What a scenario uploaded and did not delete goes after it (with the browser's account). */
After(async function () {
  const made = this.__wagtailMade || [];
  this.__wagtailMade = [];
  for (const item of made.reverse()) {
    try {
      await deleteAt(this, item.deleteUrl);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`  [wagtail-steps] could not delete the ${item.kind} "${item.title}" this scenario made: ${err.message.split('\n')[0]}`);
    }
  }
});
