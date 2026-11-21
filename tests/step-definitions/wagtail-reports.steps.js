'use strict';

// The admin's reports (the "Reports" menu: Locked pages, Workflows, Workflow tasks, Site history, Aging pages,
// Page types usage): opened by their names, read row by row.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./wagtail-helpers');

/**
 * Open a report by its name in the "Reports" menu of the sidebar.
 *
 * Example #1: When I open the "Locked pages" report
 * Example #2: When I open the "Site history" report
 * Example #3: And we open the "Workflows" report
 * Example #4: When I open the "Aging pages" report
 * Example #5: When I open the "Page types usage" report
 */
When(/^(?:I|we) open the "([^"]*)" report$/, async function (name) {
  const page = this.page;
  if (!h.onAdmin(this) || (await h.loginForm(page).username.count())) await h.open(this, h.adminUrl(this));
  const url = await page.evaluate((wanted) => {
    const walk = (items, inReports) => {
      for (const node of items || []) {
        const args = (node && node._args) || [];
        const item = args[0] || {};
        if (inReports && (item.label || '').toLowerCase() === wanted.toLowerCase()) return item.url;
        if (/SubMenuItem$/.test(node._type || '')) {
          const found = walk(args[1], /reports/i.test(item.name || item.label || ''));
          if (found) return found;
        }
      }
      return null;
    };
    try {
      const props = JSON.parse(document.querySelector('#wagtail-sidebar-props').textContent);
      return walk(props.modules.find((m) => /MainMenuModule$/.test(m._type))._args[0], false);
    } catch (e) {
      return null;
    }
  }, name);
  if (!url) throw friendly({ message: `The "Reports" menu has no report "${name}".`, hint: 'The reports an account sees depend on its permissions; name a report as the menu writes it.' });
  await h.open(this, h.absolute(this, url));
});

/**
 * Assert that the report on screen lists a row that holds a text (a page's title, an object's name), or does
 * not.
 *
 * Example #1: Then the report should list "Contact Us"
 * Example #2: Then the report should not list "Webship test page"
 * Example #3: And the report should list "Southern Cornbread"
 * Example #4: Then the report should list "Bread Page"
 * Example #5: Then the report should not list "About"
 */
Then(/^the report should( not)* list "([^"]*)"$/, async function (notCase, text) {
  const rows = await h.listingRows(this.page);
  const has = rows.some((r) => h.normal(r.title) === h.normal(text) || h.mentions(r.text, text));
  if (has === !notCase) return;
  throw friendly({ message: notCase ? `The report lists "${text}".` : `The report does not list "${text}". It lists: ${h.listed(rows.map((r) => r.title || r.text).slice(0, 20))}.`, hint: 'Open the report first: When I open the "…" report' });
});

/**
 * Assert what the row of the report on screen that holds a text says in a column, by the column's heading
 * ("Locking status", "Action", "Status", "Pages"); a part of the cell is enough.
 *
 * Example #1: Then the report row "Contact Us" should show "Locked by admin" in the "Locking status" column
 * Example #2: Then the report row "Webship test page" should show "Deleted" in the "Action" column
 * Example #3: And the report row "Southern Cornbread" should show "In progress" in the "Status" column
 * Example #4: Then the report row "Bread Page" should show "11" in the "Pages" column
 * Example #5: Then the report row "Webship test page" should show "Created" in the "Action" column
 */
Then(/^the report row "([^"]*)" should show "([^"]*)" in the "([^"]*)" column$/, async function (text, value, column) {
  const data = await this.page.locator('main table').first().evaluate((table, args) => {
    const [wanted, col] = args;
    const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.replace(/\s+/g, ' ').trim());
    const index = heads.findIndex((t) => t.toLowerCase().startsWith(col.toLowerCase()));
    const rows = [...table.querySelectorAll('tbody tr')];
    const row = rows.find((tr) => tr.innerText.toLowerCase().includes(wanted.toLowerCase()));
    if (!row) return { heads, rows: rows.map((r) => r.innerText.replace(/\s+/g, ' ').trim()).slice(0, 10) };
    const cells = [...row.querySelectorAll('td')];
    return { heads, index, cell: index >= 0 && cells[index] ? cells[index].innerText.replace(/\s+/g, ' ').trim() : null };
  }, [text, column]).catch(() => ({ heads: [], rows: [] }));
  if (data.cell === undefined) throw friendly({ message: `The report has no row that holds "${text}". Its rows: ${h.listed(data.rows)}.`, hint: 'Open the report first: When I open the "…" report' });
  if (data.cell === null) throw friendly({ message: `The report has no column "${column}". Its columns: ${h.listed(data.heads)}.`, hint: 'Name a column by its heading.' });
  if (h.mentions(data.cell, value)) return;
  throw friendly({ message: `The report row "${text}" shows "${data.cell}" in the "${column}" column, not "${value}".`, hint: 'A part of the cell is enough.' });
});
