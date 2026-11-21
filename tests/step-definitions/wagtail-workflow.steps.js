'use strict';

// Workflows: a page submitted for moderation is reviewed on the dashboard ("Awaiting your review") by an
// account of the task's group, which approves it or requests changes, with a comment or without; the account
// that submitted it follows it in "Your pages and snippets in a workflow". (Submitting is a step of the editor:
// When I submit the page for moderation.)

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./wagtail-helpers');

/** The row of a page in a panel of the dashboard, opening the dashboard first. */
async function panelRow(world, panelName, title) {
  const page = world.page;
  if (h.pathOf(world, page.url()).split('?')[0] !== h.adminPath(world)) await h.open(world, h.adminUrl(world));
  const panel = page.getByRole('region', { name: h.exactly(panelName) }).first();
  if (!(await panel.count())) {
    const panels = (await page.locator('main section h2').allTextContents()).map(h.clean);
    throw friendly({ message: `The dashboard has no panel "${panelName}". Its panels: ${h.listed(panels)}.`, hint: 'The panel shows when it has something for this account: "Awaiting your review" for a reviewer of the task.' });
  }
  const rows = panel.locator('tbody tr');
  const n = await rows.count();
  for (let i = 0; i < n; i += 1) {
    const link = rows.nth(i).locator('td').first().locator('a').first();
    if (h.normal(await link.textContent().catch(() => '')) === h.normal(title)) return rows.nth(i);
  }
  const titles = (await panel.locator('tbody tr td:first-child a').allTextContents()).map(h.clean);
  throw friendly({ message: `The panel "${panelName}" does not list "${title}". It lists: ${h.listed(titles)}.`, hint: 'A page shows there once it is submitted for moderation, to the accounts of the task\'s group.' });
}

/**
 * Review a page awaiting this account's review, from the dashboard's "Awaiting your review": approve it, or
 * request changes, with a comment or without (the comment goes in the dialog the action opens, and in the mail
 * to the account that submitted the page). The last task's approval publishes the page.
 *
 * Example #1: When I approve the page "Webship test page"
 * Example #2: When I approve the page "Webship test page" with the comment "Looks good."
 * Example #3: When I request changes to the page "Webship test page" with the comment "Please add a photo."
 * Example #4: And we request changes to the page "Webship test page" with the comment "A title, please."
 * Example #5: When we approve the page "Webship test page" with the comment "Ready to go."
 */
When(/^(?:I|we) (approve|request changes to) the page "([^"]*)"(?: with the comment "([^"]*)")?$/, { timeout: 90000 }, async function (what, title, comment) {
  const page = this.page;
  const row = await panelRow(this, 'Awaiting your review', title);
  const approve = what === 'approve';
  // "Request changes" always asks for a comment; "Approve" asks only as "Approve with comment".
  const item = approve ? (comment ? 'Approve with comment' : 'Approve') : 'Request changes';
  const toggle = row.getByRole('button', { name: 'Actions' }).first();
  if (!approve || comment) {
    await h.chooseFromDropdown(this, toggle, item, { navigate: false });
    const modal = await h.openModal(this, item);
    const field = await h.requireField(this, 'Comment', modal, 'in the dialog');
    await field.fill(comment || '');
    await h.afterNavigation(this, () => modal.locator('button[type="submit"]').first().click());
  } else {
    await h.chooseFromDropdown(this, toggle, item, { navigate: true });
  }
  // The dashboard comes back without the page in "Awaiting your review".
  await h.eventually(this, async () => {
    if (h.pathOf(this, page.url()).split('?')[0] !== h.adminPath(this)) return true;
    const panel = page.getByRole('region', { name: 'Awaiting your review' });
    if (!(await panel.count())) return true;
    const titles = (await panel.locator('tbody tr td:first-child a').allTextContents()).map(h.clean);
    return !titles.some((t) => h.normal(t) === h.normal(title));
  }, (done) => done, async () => ({
    message: `After "${item}", "${title}" is still awaiting review: ${h.listed(await h.messages(page))}.`,
    hint: 'The review is sent from the dashboard; the dashboard comes back without the page.',
  }));
  await h.pageReady(this);
});

/**
 * Assert the task of a page that this account submitted, as the dashboard's "Your pages and snippets in a
 * workflow" says it ("Awaiting Moderators approval", "Changes requested at Moderators approval").
 *
 * Example #1: Then my page "Webship test page" should be "Awaiting Moderators approval"
 * Example #2: Then my page "Webship test page" should be "Changes requested at Moderators approval"
 * Example #3: And my page "Muddy Waters" should be "Awaiting Moderators approval"
 * Example #4: Then my page "Webship test page" should be "Changes requested"
 * Example #5: Then my page "Webship test page" should be "Awaiting"
 */
Then(/^my page "([^"]*)" should be "([^"]*)"$/, async function (title, state) {
  const row = await panelRow(this, 'Your pages and snippets in a workflow', title);
  const text = h.clean(await row.innerText());
  if (h.mentions(text, state)) return;
  throw friendly({ message: `The workflow panel says "${text}" for "${title}", not "${state}".`, hint: 'The panel names the task and its state: "Awaiting <task>", "Changes requested at <task>".' });
});

/**
 * Assert that a page is awaiting this account's review on the dashboard, or is not.
 *
 * Example #1: Then the page "Webship test page" should be awaiting my review
 * Example #2: Then the page "Webship test page" should not be awaiting my review
 * Example #3: And the page "Southern Cornbread" should be awaiting my review
 * Example #4: Then the page "Muddy Waters" should be awaiting my review
 * Example #5: Then the page "About" should not be awaiting my review
 */
Then(/^the page "([^"]*)" should( not)* be awaiting my review$/, async function (title, notCase) {
  let found = true;
  try {
    await panelRow(this, 'Awaiting your review', title);
  } catch (err) {
    if (!notCase) throw err;
    found = false;
  }
  if (notCase && found) throw friendly({ message: `"${title}" is awaiting this account's review.`, hint: 'The page leaves "Awaiting your review" once it is approved, sent back, or its workflow is cancelled.' });
});
