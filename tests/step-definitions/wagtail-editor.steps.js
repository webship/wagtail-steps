'use strict';

// The editor of a page (and of a snippet with drafts): its fields by their labels, the actions of its footer
// (save a draft, publish, submit for moderation, unpublish, delete), the publishing schedule, the status side
// panel, locking, the preview panel, the autosave of the editors of 8.0 and later, and the errors of a form.
//
// The editor saves a draft by itself a moment after a field changes (autosave, Wagtail 8.0 and later): a step
// that acts waits for that save to finish first, and a step that sets a field leaves it, as a person does, so
// that the page's own scripts follow (the slug follows the title).

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./wagtail-helpers');

/** Fail with the admin's error and the errors of the fields when an action was refused. */
async function failOnRefusal(world, action) {
  const errors = await h.messages(world.page, 'error');
  if (!errors.length) return;
  const fields = (await h.fieldErrors(world.page)).map((e) => (e.label ? `${e.label}: ` : '') + e.text);
  throw friendly({
    message: `"${action}" was refused: ${h.listed(errors)}. The errors of the fields: ${h.listed(fields)}.`,
    hint: 'A required field left empty (the slug of a new page follows its title once the title field is left), or a value the field does not take.',
  });
}

/** A footer action, then the check that the admin took it. */
async function act(world, action, expected) {
  await h.footerAction(world, action);
  await failOnRefusal(world, action);
  if (expected) await h.expectMessage(world, 'success', expected);
}

/**
 * Set a field by its label, as a person does: type in a text box, choose an option by its words, "yes" or
 * "no" for a checkbox, type in a rich text editor. The label is read without its required mark ("Title*"), and
 * a field on another tab of the editor ("Slug" on "Promote") opens that tab. The step leaves the field, so the
 * page's own scripts follow (the slug follows the title; the editor saves a draft by itself).
 *
 * Example #1: When I set "Title" to "Webship test page"
 * Example #2: When I set "Introduction" to "Fresh bread every morning."
 * Example #3: And I set "Slug" to "webship-test-page"
 * Example #4: When we set "Show in menus" to "yes"
 * Example #5: When I set "Purpose" to "Question"
 */
When(/^(?:I|we) set "([^"]*)" to "([^"]*)"$/, async function (name, value) {
  const field = await h.requireField(this, name, this.page.locator('main, body').first());
  await h.setField(this, field, value);
});

/**
 * Set several fields at once, by their labels (a table of two columns: the field, the value).
 *
 * Example #1: When I set these fields:
 *               | Title        | Webship test page          |
 *               | Introduction | Fresh bread every morning. |
 * Example #2: When we set these fields:
 *               | Subject | Webship test message |
 * Example #3: And I set these fields:
 *               | Redirect from | /webship-test-old-bread |
 * Example #4: When I set these fields:
 *               | Title | Webship test bread type |
 * Example #5: When I set these fields:
 *               | Name | Webship test collection |
 */
When(/^(?:I|we) set these fields:$/, async function (table) {
  for (const [name, value] of table.raw()) {
    const field = await h.requireField(this, name, this.page.locator('main, body').first());
    await h.setField(this, field, value);
  }
});

/**
 * Assert the value a field shows, by its label: its text, the words of its chosen option, "yes"/"no" for a
 * checkbox, the words of a rich text.
 *
 * Example #1: Then "Title" should be set to "Webship test page"
 * Example #2: Then "Introduction" should be set to "First words."
 * Example #3: And "Slug" should be set to "webship-test-page"
 * Example #4: Then "Collection" should be set to "Other"
 * Example #5: Then "Show in menus" should be set to "no"
 */
Then(/^"([^"]*)" should be set to "([^"]*)"$/, async function (name, expected) {
  const field = await h.requireField(this, name, this.page.locator('main, body').first());
  const value = await h.eventually(this, () => h.fieldValue(field), (v) => h.clean(v) === h.clean(expected), async (v) => ({
    message: `"${name}" is set to "${h.clean(v)}", not "${expected}".`,
    hint: 'The value is the one the field shows: the words of an option, "yes" or "no" for a checkbox.',
  }), 3000);
  return value;
});

/**
 * Save a draft of the page or the snippet in the editor ("Save draft"). The step fails with the admin's error
 * and the errors of the fields when the draft is refused.
 *
 * Example #1: When I save the draft
 * Example #2: When we save the draft
 * Example #3: And I save the draft
 * Example #4: Then I save the draft
 * Example #5: When I save the draft
 */
When(/^(?:I|we) save the draft$/, async function () {
  await act(this, 'Save draft', '');
  await h.expectMessage(this, 'success', /\b(updated|created)\b/i, 'The admin answers a saved draft with "Page \'…\' has been updated." (or "created" for a new one).');
});

/**
 * Publish the page or the snippet in the editor ("Publish" from the "More actions" menu): the account needs
 * the permission to publish (an editor submits for moderation instead).
 *
 * Example #1: When I publish the page
 * Example #2: When we publish the page
 * Example #3: And I publish the page
 * Example #4: When I publish the page
 * Example #5: Then I publish the page
 */
When(/^(?:I|we) publish the page$/, async function () {
  await act(this, 'Publish', '');
  await h.expectMessage(this, 'success', 'published', 'The admin answers with "Page \'…\' has been published." on the explorer of the page\'s parent.');
});

/**
 * Unpublish the page in the editor: "Unpublish" from the "More actions" menu, then "Yes, unpublish it".
 *
 * Example #1: When I unpublish the page
 * Example #2: When we unpublish the page
 * Example #3: And I unpublish the page
 * Example #4: When I unpublish the page
 * Example #5: Then I unpublish the page
 */
When(/^(?:I|we) unpublish the page$/, async function () {
  await h.footerAction(this, 'Unpublish');
  await h.confirm(this, /^Yes, unpublish/);
  await h.expectMessage(this, 'success', 'unpublished');
});

/**
 * Submit the page or the snippet in the editor to its workflow ("Submit to Moderators approval", or
 * "Resubmit to …" after changes were requested).
 *
 * Example #1: When I submit the page for moderation
 * Example #2: When we submit the page for moderation
 * Example #3: And I submit the page for moderation
 * Example #4: When I submit the page for moderation
 * Example #5: Then I submit the page for moderation
 */
When(/^(?:I|we) submit the page for moderation$/, async function () {
  await h.footerAction(this, /^\s*(Re)?submit to\b/i);
  await failOnRefusal(this, 'Submit');
  await h.expectMessage(this, 'success', 'submitted for moderation');
});

/**
 * Choose an action of the editor's footer by its words, without expecting an outcome: for the actions without a
 * step of their own ("Schedule to publish", "Replace current draft", "Cancel workflow", "Approve and Publish")
 * and for a refusal. Assert the outcome with the next step.
 *
 * Example #1: When I choose "Publish" in the editor
 * Example #2: When I choose "Replace current draft" in the editor
 * Example #3: And I choose "Cancel workflow" in the editor
 * Example #4: When we choose "Schedule to publish" in the editor
 * Example #5: When I choose "Save draft" in the editor
 */
When(/^(?:I|we) choose "([^"]*)" in the editor$/, async function (action) {
  await h.footerAction(this, action);
});

/**
 * Assert that the editor offers an action (in its footer or its "More actions" menu), or does not: what an
 * account may do with the page.
 *
 * Example #1: Then the editor should offer "Publish"
 * Example #2: Then the editor should not offer "Publish"
 * Example #3: And the editor should offer "Submit to Moderators approval"
 * Example #4: Then the editor should offer "Unpublish"
 * Example #5: And the editor should not offer "Unpublish"
 */
Then(/^the editor should( not)* offer "([^"]*)"$/, async function (notCase, action) {
  const actions = await h.footerActions(this);
  const has = actions.some((a) => h.normal(a) === h.normal(action));
  if (has === !notCase) return;
  throw friendly({ message: notCase ? `The editor offers "${action}".` : `The editor does not offer "${action}". It offers: ${h.listed(actions)}.`, hint: 'The actions depend on the account and on the state of the page.' });
});

/**
 * Delete a page by its title, or the page in the editor: "Delete" from the header's "Actions" menu, then
 * "Yes, delete it". The page's children go with it.
 *
 * Example #1: When I delete the page "Webship test page"
 * Example #2: When we delete the page "Webship test revisions"
 * Example #3: And I delete the page "Webship test page"
 * Example #4: When I delete the page
 * Example #5: When we delete the page
 */
When(/^(?:I|we) delete the page(?: "([^"]*)")?$/, async function (title) {
  if (title) {
    const id = await h.pageId(this, title);
    await h.open(this, h.adminUrl(this, `pages/${id}/delete/`));
  } else {
    await h.headerAction(this, 'Delete');
  }
  await h.confirm(this, /^Yes, delete/);
  await h.expectMessage(this, 'success', 'deleted');
});

/**
 * Assert a status the status side panel of the editor shows: "Draft", "Live", "In Moderation", "Locked by you",
 * "Unlocked", "Visible to all", or a line under one ("Go-live: Jan. 1, 2030, 9 a.m."). A part of the line is
 * enough.
 *
 * Example #1: Then the status panel should say "Draft"
 * Example #2: Then the status panel should say "Live"
 * Example #3: And the status panel should say "Locked by you"
 * Example #4: Then the status panel should say "Go-live: Jan. 1, 2030"
 * Example #5: Then the status panel should say "In Moderation"
 */
Then(/^the status panel should say "([^"]*)"$/, async function (expected) {
  const status = await h.statusOf(this);
  const lines = [...Object.values(status.sections).flat(), ...status.help];
  if (lines.some((l) => h.normal(l) === h.normal(expected) || h.mentions(l, expected))) return;
  throw friendly({ message: `The status panel does not say "${expected}". It says: ${h.listed(lines)}.`, hint: 'The status panel sums up the page: its status, its schedule, its locale, its lock, who may see it.' });
});

/**
 * Set the publishing schedule of the page in the editor ("Set schedule" in the status panel, a date and time as
 * "YYYY-MM-DD HH:MM", "Save schedule"), then "Schedule to publish". The page is scheduled: it goes live at that
 * time (when the site runs its publish_scheduled command).
 *
 * Example #1: When I schedule the page to go live at "2030-01-01 09:00"
 * Example #2: When we schedule the page to go live at "2031-06-15 12:30"
 * Example #3: And I schedule the page to go live at "2030-01-01 09:00"
 * Example #4: When I schedule the page to go live at "2032-12-31 23:00"
 * Example #5: When I schedule the page to go live at "2030-02-01 08:00"
 */
When(/^(?:I|we) schedule the page to go live at "([^"]*)"$/, async function (when) {
  const page = this.page;
  await h.autosaveSettled(this);
  const panel = await h.statusPanel(this);
  const open = panel.getByRole('button', { name: /^(Set|Edit) schedule$/ }).first();
  if (!(await open.count())) throw friendly({ message: 'The status panel offers no "Set schedule".', hint: 'The account needs the permission to publish the page to schedule it.' });
  await open.click();
  const dialog = page.locator('#schedule-publishing-dialog');
  await dialog.waitFor({ state: 'visible', timeout: h.budget(this) });
  const field = await h.requireField(this, 'Go live date/time', dialog, 'in the schedule dialog');
  await field.fill(when);
  // Leave the field for the dialog's title: the date picker closes (Escape would close the whole dialog).
  await dialog.locator('h2, .w-dialog__title').first().click();
  await h.afterNavigation(this, () => dialog.getByRole('button', { name: 'Save schedule' }).click());
  await failOnRefusal(this, 'Save schedule');
  await act(this, 'Schedule to publish', 'scheduled for publishing');
});

/**
 * Lock or unlock the page in the editor ("Lock" in the status panel; "Unlock" in the message of a locked page).
 * A locked page can be changed only by the account that locked it (and by one with the permission to unlock).
 *
 * Example #1: When I lock the page
 * Example #2: When I unlock the page
 * Example #3: And we lock the page
 * Example #4: When we unlock the page
 * Example #5: Then I unlock the page
 */
When(/^(?:I|we) (lock|unlock) the page$/, async function (what) {
  const page = this.page;
  await h.autosaveSettled(this);
  if (what === 'unlock') {
    const button = page.locator('.messages li').getByRole('button', { name: 'Unlock' }).or(page.locator('.messages li').getByRole('link', { name: 'Unlock' })).first();
    if (await button.count()) {
      await h.afterNavigation(this, () => button.click());
      await h.expectMessage(this, 'success', 'unlocked');
      return;
    }
  }
  const panel = await h.statusPanel(this);
  const toggle = panel.locator('label.switch').filter({ hasText: /^\s*Lock\s*$/ }).first();
  if (!(await toggle.count())) throw friendly({ message: `The status panel offers no "Lock" switch: ${h.listed(Object.values((await h.statusOf(this)).sections).flat())}.`, hint: 'The account needs the permission to lock the page; a page locked by another account shows who locked it.' });
  const on = await toggle.locator('input').isChecked();
  if (on === (what === 'lock')) return;
  await h.afterNavigation(this, () => toggle.click());
  // A lock is told as information ("'…' was locked by you on …"), an unlock as a success.
  await h.expectMessage(this, what === 'lock' ? 'any' : 'success', what === 'lock' ? 'locked by you' : 'unlocked');
});

/**
 * Assert what the preview panel of the editor shows: the page as the site renders it with the edits of the
 * editor, rendered again a moment after each change. The step opens the panel and waits for the preview.
 *
 * Example #1: Then the preview should show "Webship test page"
 * Example #2: Then the preview should show "Fresh bread every morning."
 * Example #3: And the preview should not show "Our oven"
 * Example #4: Then the preview should show "Webship test page renamed"
 * Example #5: Then the preview should not show "First words."
 */
Then(/^the preview should( not)* show "([^"]*)"$/, async function (notCase, expected) {
  await h.autosaveSettled(this);
  await h.previewPanel(this);
  await h.eventually(this, () => h.previewText(this), (text) => text !== '' && h.mentions(text, expected) === !notCase, async (text) => ({
    message: notCase ? `The preview shows "${expected}".` : `The preview does not show "${expected}". It shows: "${text.slice(0, 300)}".`,
    hint: 'The preview renders the edits a moment after a field is left; a field the page\'s template does not show is not in the preview.',
  }));
});

/**
 * Assert that the editor saved the edits by itself (autosave, Wagtail 8.0 and later): its indicator says
 * "Saved", and no edit is waiting.
 *
 * Example #1: Then the edits should be saved by themselves
 * Example #2: Then the edits should be saved by themselves
 * Example #3: And the edits should be saved by themselves
 * Example #4: Then the edits should be saved by themselves
 * Example #5: And the edits should be saved by themselves
 */
Then(/^the edits should be saved by themselves$/, async function () {
  const page = this.page;
  if (!(await page.locator('#w-autosave-indicator').count())) {
    throw friendly({ message: 'This editor has no autosave indicator.', hint: 'Autosave came with Wagtail 8.0; on an older release save the draft: When I save the draft' });
  }
  await h.autosaveSettled(this);
  const state = await h.eventually(this, () => page.locator('#w-autosave-indicator').getAttribute('data-w-autosave-state-value'), (s) => s === 'saved', async (s) => ({
    message: `The autosave indicator says "${s || 'nothing yet'}", not "saved".`,
    hint: '"paused" means the edits have an error to correct first; the editor saves a moment after a field is left.',
  }));
  return state;
});

/**
 * Assert the error a field of a form shows, by its label (the editor marks the field and says "The page could
 * not be created due to validation errors." above the form).
 *
 * Example #1: Then the "Slug" field should have the error "This field is required."
 * Example #2: Then the "Title" field should have the error "This field is required."
 * Example #3: And the "Redirect to any URL" field should have the error "Enter a valid URL."
 * Example #4: Then the "Parent" field should have the error "This field is required."
 * Example #5: Then the "Redirect from" field should have the error "This field is required."
 */
Then(/^the "([^"]*)" field should have the error "([^"]*)"$/, async function (name, expected) {
  const errors = await h.eventually(this, () => h.fieldErrors(this.page), (list) => list.some((e) => h.normal(e.label) === h.normal(name) && h.mentions(e.text, expected)), async (list) => ({
    message: `The field "${name}" does not show the error "${expected}". The errors of the form: ${h.listed(list.map((e) => (e.label ? `${e.label}: ` : '') + e.text))}.`,
    hint: 'Send the form first; the admin writes the error of a field under its label.',
  }), 5000);
  return errors;
});
