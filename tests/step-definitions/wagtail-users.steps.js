'use strict';

// Users and groups, read as the admin shows them (a suite never makes or deletes an account): the users list
// (name, user name, access level, active), and a group's permissions on pages and its other permissions.

const { Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./wagtail-helpers');

/** The users list's rows: [{ name, username, access, active, text }], the columns read by their headings. */
async function userRows(world) {
  await h.open(world, h.adminUrl(world, 'users/'));
  return world.page.locator('main table').first().evaluate((table) => {
    const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.replace(/\s+/g, ' ').trim().toLowerCase());
    const col = (name) => heads.findIndex((t) => t.startsWith(name));
    return [...table.querySelectorAll('tbody tr')].map((tr) => {
      const cells = [...tr.querySelectorAll('td')].map((td) => td.innerText.replace(/\s+/g, ' ').trim());
      return { name: cells[col('name')] || '', username: cells[col('username')] || '', access: cells[col('access')] || '', active: cells[col('active')] || '', text: cells.join(' | ') };
    });
  });
}

/**
 * Assert a column of an account in the users list ("Access level": "Admin" for a superuser; "Active": "True" or
 * "False"; "Name"), by the account's user name or a handle of the users registry.
 *
 * Example #1: Then the users list should show "administrator" with the access level "Admin"
 * Example #2: Then the users list should show "editor" with the access level ""
 * Example #3: And the users list should show "member" as active
 * Example #4: Then the users list should show "inactive" as not active
 * Example #5: Then the users list should show "moderator" with the name "Jordan Rules"
 */
Then(/^the users list should show "([^"]*)" (?:with the (access level|name) "([^"]*)"|as (not )?active)$/, async function (who, column, value, notActive) {
  const username = h.accountOf(this, who).username;
  const rows = await userRows(this);
  const row = rows.find((r) => r.username.toLowerCase() === String(username).toLowerCase());
  if (!row) throw friendly({ message: `The users list has no "${username}". It lists: ${h.listed(rows.map((r) => r.username))}.`, hint: 'The accounts are made by the build of the site.' });
  if (column) {
    const got = column === 'name' ? row.name : row.access;
    if (h.normal(got) === h.normal(value)) return;
    throw friendly({ message: `The users list shows "${username}" with the ${column} "${got}", not "${value}".`, hint: 'A superuser has the access level "Admin"; any other account has none.' });
  }
  const active = /^true$/i.test(row.active);
  if (active === !notActive) return;
  throw friendly({ message: `The users list shows "${username}" as ${active ? '' : 'not '}active.`, hint: 'An inactive account cannot log in.' });
});

/** Open a group's page by its name, from Settings › Groups. */
async function openGroup(world, name) {
  const page = world.page;
  await h.open(world, h.adminUrl(world, 'groups/'));
  const link = page.locator('main table tbody a').filter({ hasText: h.exactly(name) }).first();
  if (!(await link.count())) throw friendly({ message: `There is no group "${name}": ${h.listed((await h.listingRows(page)).map((r) => r.title))}.`, hint: 'Groups are made with the site (Wagtail makes Editors and Moderators).' });
  await h.afterNavigation(world, () => link.click());
}

/**
 * Assert a permission of a group on the pages under a page ("Add", "Edit", "Publish", "Lock", "Unlock", "Bulk
 * delete"), as its "Page permissions" table ticks it, or does not.
 *
 * Example #1: Then the group "Editors" should be allowed to "Edit" the pages under "Root"
 * Example #2: Then the group "Editors" should not be allowed to "Publish" the pages under "Root"
 * Example #3: And the group "Moderators" should be allowed to "Publish" the pages under "Root"
 * Example #4: Then the group "Moderators" should be allowed to "Lock" the pages under "Root"
 * Example #5: Then the group "Editors" should not be allowed to "Lock" the pages under "Root"
 */
Then(/^the group "([^"]*)" should( not)* be allowed to "([^"]*)" the pages under "([^"]*)"$/, async function (group, notCase, permission, root) {
  await openGroup(this, group);
  const result = await this.page.getByRole('region', { name: 'Page permissions' }).first().evaluate((section, args) => {
    const [perm, pageTitle] = args;
    const heads = [...section.querySelectorAll('thead th')].map((th) => th.textContent.replace(/\s+/g, ' ').trim().toLowerCase());
    const col = heads.indexOf(perm.toLowerCase());
    const rows = [];
    for (const tr of section.querySelectorAll('tbody tr')) {
      const cells = [...tr.querySelectorAll('td')];
      const title = (cells[0] ? cells[0].textContent : '').replace(/Page\*?/, '').replace(/\s+/g, ' ').trim();
      rows.push(title);
      if (title.toLowerCase().includes(pageTitle.toLowerCase()) && col >= 0 && cells[col]) {
        const box = cells[col].querySelector('input[type="checkbox"]');
        return { found: true, checked: !!(box && box.checked), heads, rows };
      }
    }
    return { found: false, col, heads, rows };
  }, [permission, root]).catch(() => ({ found: false, heads: [], rows: [] }));
  if (!result.found) {
    throw friendly({ message: `The group "${group}" has no page permission "${permission}" on "${root}". The table's columns: ${h.listed(result.heads)}; its pages: ${h.listed(result.rows)}.`, hint: 'Name a column of the "Page permissions" table and the page of one of its rows.' });
  }
  if (result.checked === !notCase) return;
  throw friendly({ message: `The group "${group}" is ${result.checked ? '' : 'not '}allowed to "${permission}" the pages under "${root}".`, hint: 'The permissions of a group are set on its page in Settings › Groups.' });
});

/**
 * Assert another permission of a group (its "Other permissions" and the object permissions, by the words of
 * the permission), as its page ticks it, or does not.
 *
 * Example #1: Then the group "Editors" should have the permission "Can add footer text"
 * Example #2: Then the group "Editors" should have the permission "Can change person"
 * Example #3: And the group "Editors" should not have the permission "Can add user"
 * Example #4: Then the group "Moderators" should not have the permission "Can change user"
 * Example #5: Then the group "Editors" should not have the permission "Can delete group"
 */
Then(/^the group "([^"]*)" should( not)* have the permission "([^"]*)"$/, async function (group, notCase, permission) {
  await openGroup(this, group);
  const boxes = await this.page.locator('main input[type="checkbox"]').evaluateAll((els) => els.map((el) => {
    const label = document.querySelector(`label[for="${el.id}"]`);
    const words = ((label && label.textContent) || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    return { words, checked: el.checked };
  }).filter((b) => b.words));
  const box = boxes.find((b) => b.words.toLowerCase() === permission.toLowerCase() || b.words.toLowerCase().endsWith(`| ${permission.toLowerCase()}`));
  if (!box) throw friendly({ message: `The group "${group}" has no permission "${permission}" on its page.`, hint: 'Name a permission by its words, as the group\'s page writes them ("Can add footer text").' });
  if (box.checked === !notCase) return;
  throw friendly({ message: `The group "${group}" ${box.checked ? 'has' : 'does not have'} the permission "${permission}".`, hint: 'The permissions of a group are set on its page in Settings › Groups.' });
});
