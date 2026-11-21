'use strict';

// Forms made with the form builder: the form of a form page on the site, filled in and sent as a visitor does,
// and in the admin the forms with their submissions, a submission found and deleted.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./wagtail-helpers');

/** The form-builder form of the page on screen: the form that posts to the page's own address. */
async function pageForm(world) {
  const page = world.page;
  const here = new URL(page.url()).pathname;
  const forms = page.locator('form[method="post" i]');
  const n = await forms.count();
  for (let i = 0; i < n; i += 1) {
    const action = (await forms.nth(i).getAttribute('action')) || here;
    if (new URL(action, page.url()).pathname === here) return forms.nth(i);
  }
  throw friendly({ message: `The page has no form of its own (a form that sends to ${here}): ${await h.pageSummary(world)}.`, hint: 'A form page of the form builder sends its form to its own address. Open the form page first.' });
}

/**
 * Fill in and send the form of the page on screen (a form page of the form builder), as a visitor does: its
 * fields by their labels (a table of two columns: the field, the value), then its submit button. The step waits
 * for the page the form leads to.
 *
 * Example #1: When I send the form of this page with:
 *               | Subject    | Webship test message |
 *               | Your Name  | Webship Tester       |
 * Example #2: When we send the form of this page with:
 *               | Your Email | tester@example.com |
 * Example #3: And I send the form of this page with:
 *               | Purpose | Question |
 * Example #4: When I send the form of this page with:
 *               | Body | Do you bake rye bread on Sundays? |
 * Example #5: When I send the form of this page with:
 *               | Subject | Webship test question |
 */
When(/^(?:I|we) send the form of this page with:$/, async function (table) {
  const form = await pageForm(this);
  for (const [name, value] of table.raw()) {
    await h.setField(this, await h.requireField(this, name, form, 'in the form'), value);
  }
  const submit = form.locator('button[type="submit"], input[type="submit"]').first();
  await h.afterNavigation(this, () => submit.click());
});

/**
 * Assert that the browser refuses to send the form of the page on screen because a field is empty or wrong
 * (the field's own check: required, an email address), and which field: the browser marks it invalid.
 *
 * Example #1: Then the form of this page should not be sent for "Subject"
 * Example #2: Then the form of this page should not be sent for "Your Email"
 * Example #3: And the form of this page should not be sent for "Body"
 * Example #4: Then the form of this page should not be sent for "Your Name"
 * Example #5: Then the form of this page should not be sent for "Subject"
 */
Then(/^the form of this page should not be sent for "([^"]*)"$/, async function (name) {
  const form = await pageForm(this);
  const field = await h.requireField(this, name, form, 'in the form');
  const state = await field.evaluate((el) => ({ valid: el.checkValidity(), message: el.validationMessage }));
  if (!state.valid) return;
  throw friendly({ message: `The field "${name}" is valid: the form would be sent.`, hint: 'A required field left empty, or an email field with something that is not an address, keeps the form from being sent.' });
});

/**
 * Open the submissions of a form page in the admin (Forms, then the form by its title).
 *
 * Example #1: When I go to the submissions of the form "Contact Us"
 * Example #2: When we go to the submissions of the form "Contact Us"
 * Example #3: And I go to the submissions of the form "Contact Us"
 * Example #4: When I go to the submissions of the form "Contact Us"
 * Example #5: Given I go to the submissions of the form "Contact Us"
 */
When(/^(?:I|we) go to the submissions of the form "([^"]*)"$/, async function (title) {
  const page = this.page;
  await h.open(this, h.adminUrl(this, 'forms/'));
  const link = page.locator('main table tbody tr td:first-child a, main table tbody tr td a').filter({ hasText: h.exactly(title) }).first();
  if (!(await link.count())) throw friendly({ message: `The forms do not list "${title}": ${h.listed((await h.listingRows(page)).map((r) => r.title))}.`, hint: 'Forms lists the form pages the account may see.' });
  await h.afterNavigation(this, () => link.click());
});

/**
 * Assert that the submissions on screen list one that holds a text (in any of its columns), or do not.
 *
 * Example #1: Then the submissions should list "Webship test message"
 * Example #2: Then the submissions should not list "Webship test message"
 * Example #3: And the submissions should list "tester@example.com"
 * Example #4: Then the submissions should list "What's up?"
 * Example #5: Then the submissions should not list "Webship test question"
 */
Then(/^the submissions should( not)* list "([^"]*)"$/, async function (notCase, text) {
  const rows = await h.listingRows(this.page);
  const has = rows.some((r) => h.mentions(r.text, text));
  if (has === !notCase) return;
  throw friendly({ message: notCase ? `The submissions list "${text}".` : `No submission holds "${text}". They are: ${h.listed(rows.map((r) => r.text))}.`, hint: 'Open the submissions first: When I go to the submissions of the form "…"' });
});

/**
 * Assert the columns of the submissions on screen: the submission date, then one column per field of the form.
 *
 * Example #1: Then the submissions should have the columns "Submission date", "Subject", "Your Name", "Your Email", "Purpose", "Body"
 * Example #2: Then the submissions should have the columns "Submission date", "Subject"
 * Example #3: And the submissions should have the columns "Subject", "Body"
 * Example #4: Then the submissions should have the columns "Your Email"
 * Example #5: Then the submissions should have the columns "Submission date", "Purpose"
 */
Then(/^the submissions should have the columns ((?:"[^"]*"(?:, )?)+)$/, async function (list) {
  const expected = [...list.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  const columns = (await this.page.locator('main table thead th').allTextContents()).map(h.clean).filter(Boolean);
  const missing = expected.filter((c) => !columns.some((x) => h.normal(x) === h.normal(c)));
  if (!missing.length) return;
  throw friendly({ message: `The submissions have no column ${h.listed(missing)}. Their columns: ${h.listed(columns)}.`, hint: 'The columns are the fields of the form, by their labels.' });
});

/**
 * Delete a submission of the form on screen, found by a text it holds: its checkbox, "Delete", then the
 * confirmation's "Delete".
 *
 * Example #1: When I delete the submission "Webship test message"
 * Example #2: When we delete the submission "Webship test question"
 * Example #3: And I delete the submission "tester@example.com"
 * Example #4: When I delete the submission "Webship test message"
 * Example #5: When we delete the submission "Webship test message"
 */
When(/^(?:I|we) delete the submission "([^"]*)"$/, async function (text) {
  const page = this.page;
  const row = page.locator('main table tbody tr').filter({ hasText: new RegExp(h.escapeRegExp(text), 'i') }).first();
  if (!(await row.count())) throw friendly({ message: `No submission holds "${text}": ${h.listed((await h.listingRows(page)).map((r) => r.text))}.`, hint: 'Open the submissions first: When I go to the submissions of the form "…"' });
  await row.locator('input[type="checkbox"]').first().check();
  const del = page.getByRole('link', { name: /^Delete/ }).or(page.getByRole('button', { name: /^Delete/ })).first();
  await h.eventually(this, () => del.isVisible().catch(() => false), (v) => v, async () => ({ message: 'No "Delete" came up for the chosen submission.', hint: 'Choosing a submission\'s checkbox offers "Delete".' }), 5000);
  await h.afterNavigation(this, () => del.click());
  await h.confirm(this, /^(Yes, delete|Delete)$/);
  await h.expectMessage(this, 'success', 'deleted');
});
