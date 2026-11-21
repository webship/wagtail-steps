'use strict';

// StreamField: a field of blocks ("Page body"), in the editor. Blocks are added from the field's own chooser
// ("Insert a block", then the block's name), set by the labels of their fields, moved up and down, duplicated
// and removed with the block's own buttons, and read back in their order. A field is named by its label; a
// block by its place in the field, counted from 1.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./wagtail-helpers');

/** The section of the editor that holds a StreamField, by the field's label. */
async function streamField(world, name) {
  const page = world.page;
  const sections = page.locator('section.w-panel').filter({ has: page.locator('[data-streamfield-stream-container]') });
  const n = await sections.count();
  const names = [];
  for (let i = 0; i < n; i += 1) {
    const section = sections.nth(i);
    const label = h.clean(await section.locator('h2, .w-panel__heading').first().textContent().catch(() => ''));
    names.push(label);
    if (h.normal(label) === h.normal(name)) {
      await h.showFieldTab(world, section);
      return section;
    }
  }
  throw friendly({ message: `The editor has no field of blocks "${name}". Its fields of blocks: ${h.listed(names)}.`, hint: 'Name the field by its label, as the editor writes it over the blocks.' });
}

/** The blocks of a field at its top level, in their order, without the removed ones. */
async function blocksOf(section) {
  const container = section.locator('[data-streamfield-stream-container]').first();
  const children = container.locator(':scope > [data-streamfield-child]');
  const n = await children.count();
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const child = children.nth(i);
    const gone = await child.evaluate((el) => el.getAttribute('aria-hidden') === 'true' || el.style.display === 'none' || (el.querySelector(':scope > input[name$="-deleted"]') || {}).value === '1');
    if (gone) continue;
    const type = h.clean(await child.locator('.c-sf-block__type').first().textContent().catch(() => ''));
    out.push({ locator: child, type });
  }
  return out;
}

/** One block of a field, by its place (from 1), or a failure that says how many there are. */
async function blockAt(world, number, name) {
  const section = await streamField(world, name);
  const blocks = await blocksOf(section);
  const i = h.indexOf(number, 'block');
  if (!blocks[i]) throw friendly({ message: `"${name}" has no block ${number}: it has ${blocks.length} (${h.listed(blocks.map((b) => b.type))}).`, hint: 'Count the blocks from 1, from the top.' });
  return blocks[i];
}

/** Wait until a field has a number of blocks (the editor animates a removal). */
async function waitForCount(world, section, count, what) {
  return h.eventually(world, () => blocksOf(section), (b) => b.length === count, async (b) => ({
    message: `${what}: the field has ${b.length} blocks (${h.listed(b.map((x) => x.type))}), not ${count}.`,
    hint: 'The editor adds, removes and moves a block in the page at once; a block that is gone is hidden first, then removed.',
  }), 5000);
}

/**
 * Add a block of a kind at the end of a field of blocks: the field's last "Insert a block" button, then the
 * kind by its name in the chooser that opens.
 *
 * Example #1: When I add a "Heading block" block to "Page body"
 * Example #2: When we add a "Paragraph block" block to "Page body"
 * Example #3: And I add a "Block quote" block to "Page body"
 * Example #4: When I add a "Paragraph block" block to "Page body"
 * Example #5: When I add a "Image block" block to "Page body"
 */
When(/^(?:I|we) add an? "([^"]*)" block to "([^"]*)"$/, async function (kind, name) {
  const page = this.page;
  const section = await streamField(this, name);
  const before = (await blocksOf(section)).length;
  // The field's own last "Insert a block" button (after its last block): not one of a block inside a block, not
  // the one of a rich text editor, which has the same name.
  const index = await section.evaluate((sec) => {
    const container = sec.querySelector('[data-streamfield-stream-container]');
    const buttons = [...sec.querySelectorAll('button.c-sf-add-button')];
    const own = buttons.filter((b) => b.closest('[data-streamfield-stream-container]') === container);
    return own.length ? buttons.indexOf(own[own.length - 1]) : -1;
  });
  if (index < 0) throw friendly({ message: `"${name}" has no "Insert a block" button.`, hint: 'A field of blocks that has its maximum number of blocks offers no more.' });
  await section.locator('button.c-sf-add-button').nth(index).click();
  const option = page.getByRole('option', { name: h.exactly(kind) }).first();
  await h.eventually(this, () => option.isVisible().catch(() => false), (v) => v, async () => {
    const offered = (await page.getByRole('option').allTextContents()).map(h.clean);
    await page.keyboard.press('Escape').catch(() => {});
    return { message: `The block chooser of "${name}" offers no "${kind}". It offers: ${h.listed(offered)}.`, hint: 'Name the kind of block by its name in the chooser.' };
  }, 5000);
  await option.click();
  await waitForCount(this, section, before + 1, `Adding a "${kind}" block`);
});

/**
 * Set a field of a block, by the field's label inside the block ("Heading text", "Size"); a block of rich text
 * (a paragraph) is set with the name of its kind ("Paragraph block").
 *
 * Example #1: When I set "Heading text" to "Our oven" in block 1 of "Page body"
 * Example #2: When I set "Size" to "H3" in block 1 of "Page body"
 * Example #3: And I set "Paragraph block" to "Fresh bread every morning." in block 2 of "Page body"
 * Example #4: When we set "Quote text" to "Bread is life." in block 3 of "Page body"
 * Example #5: When I set "Heading text" to "Our flour" in block 2 of "Page body"
 */
When(/^(?:I|we) set "([^"]*)" to "([^"]*)" in block (\d+) of "([^"]*)"$/, async function (label, value, number, name) {
  const block = await blockAt(this, number, name);
  let field = await h.findField(this, label, block.locator);
  if (!field && h.normal(block.type) === h.normal(label)) {
    // A block of one field (a rich text, a text) has no label of its own: its kind names it.
    field = block.locator.locator('[contenteditable="true"], input:not([type="hidden"]), textarea, select').first();
    if (!(await field.count())) field = null;
  }
  if (!field) {
    throw friendly({ message: `Block ${number} of "${name}" (${block.type}) has no field "${label}". Its fields: ${h.listed(await h.fieldLabels(this.page, block.locator))}.`, hint: 'Name a field by its label inside the block; a block of one rich text by the kind of the block.' });
  }
  await h.setField(this, field, value);
});

/**
 * Move a block of a field up or down by one place, with the block's own buttons ("Move up", "Move down").
 *
 * Example #1: When I move block 2 of "Page body" up
 * Example #2: When I move block 1 of "Page body" down
 * Example #3: And we move block 3 of "Page body" up
 * Example #4: When I move block 2 of "Page body" down
 * Example #5: When I move block 2 of "Page body" up
 */
When(/^(?:I|we) move block (\d+) of "([^"]*)" (up|down)$/, async function (number, name, direction) {
  const section = await streamField(this, name);
  const block = await blockAt(this, number, name);
  const before = (await blocksOf(section)).map((b) => b.type);
  const button = block.locator.locator(direction === 'up' ? '[data-streamfield-action="MOVE_UP"]' : '[data-streamfield-action="MOVE_DOWN"]').first();
  if (await button.isDisabled()) throw friendly({ message: `Block ${number} of "${name}" cannot move ${direction}: it is the ${direction === 'up' ? 'first' : 'last'} one.`, hint: 'The block\'s "Move up" is disabled on the first block, "Move down" on the last.' });
  await button.click();
  const i = h.indexOf(number, 'block');
  const j = direction === 'up' ? i - 1 : i + 1;
  const expected = [...before];
  [expected[i], expected[j]] = [expected[j], expected[i]];
  await h.eventually(this, async () => (await blocksOf(section)).map((b) => b.type), (now) => now.join('|') === expected.join('|'), async (now) => ({
    message: `After moving block ${number} ${direction}, the blocks are ${h.listed(now)}.`, hint: 'The editor moves a block at once.',
  }), 5000);
  await h.autosaveSettled(this);
});

/**
 * Remove a block of a field with its "Delete" button, or make a copy of it with its "Duplicate" button (the
 * copy comes right after it).
 *
 * Example #1: When I remove block 1 of "Page body"
 * Example #2: When I duplicate block 1 of "Page body"
 * Example #3: And we remove block 2 of "Page body"
 * Example #4: When I duplicate block 2 of "Page body"
 * Example #5: When I remove block 3 of "Page body"
 */
When(/^(?:I|we) (remove|duplicate) block (\d+) of "([^"]*)"$/, async function (what, number, name) {
  const section = await streamField(this, name);
  const before = (await blocksOf(section)).length;
  const block = await blockAt(this, number, name);
  await block.locator.locator(what === 'remove' ? '[data-streamfield-action="DELETE"]' : '[data-streamfield-action="DUPLICATE"]').first().click();
  await waitForCount(this, section, what === 'remove' ? before - 1 : before + 1, `${what === 'remove' ? 'Removing' : 'Duplicating'} block ${number}`);
  await h.autosaveSettled(this);
});

/**
 * Assert how many blocks a field of blocks has.
 *
 * Example #1: Then "Page body" should have 2 blocks
 * Example #2: Then "Page body" should have 1 block
 * Example #3: And "Page body" should have 0 blocks
 * Example #4: Then "Page body" should have 3 blocks
 * Example #5: Then "Page body" should have 2 blocks
 */
Then(/^"([^"]*)" should have (\d+) blocks?$/, async function (name, count) {
  const section = await streamField(this, name);
  await waitForCount(this, section, parseInt(count, 10), `"${name}"`);
});

/**
 * Assert the kinds of the blocks of a field, in their order from the top.
 *
 * Example #1: Then the blocks of "Page body" should be "Heading block", "Paragraph block"
 * Example #2: Then the blocks of "Page body" should be "Paragraph block", "Heading block"
 * Example #3: And the blocks of "Page body" should be "Paragraph block"
 * Example #4: Then the blocks of "Page body" should be "Heading block", "Heading block", "Paragraph block"
 * Example #5: Then the blocks of "Page body" should be "Block quote", "Paragraph block"
 */
Then(/^the blocks of "([^"]*)" should be ((?:"[^"]*"(?:, )?)+)$/, async function (name, list) {
  const expected = [...list.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  const section = await streamField(this, name);
  await h.eventually(this, async () => (await blocksOf(section)).map((b) => b.type), (now) => now.length === expected.length && now.every((t, i) => h.normal(t) === h.normal(expected[i])), async (now) => ({
    message: `The blocks of "${name}" are ${h.listed(now)}, not ${h.listed(expected)}.`,
    hint: 'The blocks are read from the top, each by the name of its kind.',
  }), 5000);
});
