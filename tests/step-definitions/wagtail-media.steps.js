'use strict';

// The image and document libraries and their collections: upload (the admin's own upload page, which sends each
// file as it is chosen), the title and the collection of what was uploaded, the libraries' lists, search and
// filter, an image's focal point, and deleting an image, a document or a collection.

const path = require('path');
const { When, Then } = require('@cucumber/cucumber');
const { friendly, resolveAssetFile } = require('webship-js/tests/step-definitions/webship');
const h = require('./wagtail-helpers');

const KINDS = {
  image: { list: 'images/', add: 'images/multiple/add/', updated: 'Image updated.', noun: 'image', plural: 'images' },
  document: { list: 'documents/', add: 'documents/multiple/add/', updated: 'Document updated.', noun: 'document', plural: 'documents' },
};

/** A file a step names: the project's tests/assets/ (webship-js), then this pack's own tests/fixtures/. */
function fileOf(world, name) {
  try {
    return resolveAssetFile(world, name);
  } catch (err) {
    const own = path.resolve(__dirname, '..', 'fixtures', name);
    if (require('fs').existsSync(own)) return own;
    throw err;
  }
}

/** Whether the page on screen is a library's listing (not its upload page, not an item's page). */
function onLibrary(world, kind) {
  return h.pathOf(world, world.page.url()).split('?')[0] === h.adminPath(world) + KINDS[kind].list;
}

/** The titles a library lists on the page on screen. */
async function libraryTitles(world, kind) {
  if (kind === 'image') return h.imageTitles(world.page);
  return (await h.listingRows(world.page)).map((r) => r.title);
}

/**
 * Upload an image or a document from a file, as a person does on the library's upload page: the file chosen
 * (it is sent at once), then the title it gets (in place of the file's name) and, when given, its collection,
 * then "Update". A file is found in the project's tests/assets/ folder, else among this pack's fixtures
 * (webship-test-loaf.png, webship-test-recipe.pdf).
 *
 * Example #1: When I upload the image "webship-test-loaf.png" with the title "Webship test loaf"
 * Example #2: When I upload the document "webship-test-recipe.pdf" with the title "Webship test recipe"
 * Example #3: And I upload the image "webship-test-loaf.png" with the title "Webship test loaf" to the collection "Other"
 * Example #4: When we upload the document "webship-test-recipe.pdf" with the title "Webship test recipe" to the collection "Recipes"
 * Example #5: When I upload the image "webship-test-loaf.png" with the title "Webship test focal point"
 */
When(/^(?:I|we) upload the (image|document) "([^"]*)" with the title "([^"]*)"(?: to the collection "([^"]*)")?$/, { timeout: 90000 }, async function (kind, file, title, collection) {
  const page = this.page;
  const k = KINDS[kind];
  const source = fileOf(this, file);
  await h.open(this, h.adminUrl(this, k.add));
  const input = page.locator('main input[type="file"]').first();
  if (!(await input.count())) throw friendly({ message: `The upload page of the ${k.plural} has no file field: ${await h.pageSummary(this)}.`, hint: `The account needs the permission to add ${k.plural}.` });
  const before = await page.locator('#upload-list > li').count();
  await input.setInputFiles(source);
  const row = page.locator('#upload-list > li').nth(before);
  await h.eventually(this, async () => (await row.getAttribute('class').catch(() => '')) || '', (cls) => /upload-complete|upload-failure|upload-server-error/.test(cls), async (cls) => ({
    message: `The upload of "${file}" did not finish (${cls || 'no row'}).`, hint: 'The upload page sends the file as soon as it is chosen and shows a row for it.',
  }), h.budget(this) * 3);
  const cls = await row.getAttribute('class');
  if (!/upload-success/.test(cls)) {
    const shown = (await row.locator('.status-msg, .error-message').evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.textContent))).map(h.clean).filter(Boolean);
    throw friendly({ message: `The ${k.noun} "${file}" was refused: ${h.listed(shown)}.`, hint: kind === 'image' ? 'The image library takes AVIF, GIF, JPG, JPEG, PNG and WEBP files.' : 'A document of a kind the site does not take is refused.' });
  }
  await h.setField(this, await h.requireField(this, 'Title', row, 'in the uploaded row'), title);
  if (collection) await h.setField(this, await h.requireField(this, 'Collection', row, 'in the uploaded row'), collection);
  const id = (h.clean(await row.locator('form').first().getAttribute('action')).match(/\/(\d+)\/?$/) || [])[1];
  await row.getByRole('button', { name: 'Update' }).click();
  await h.expectMessage(this, 'any', k.updated, `The upload page writes "${k.updated}" once the details are saved.`);
  if (id) h.madeInScenario(this, kind, title, h.adminUrl(this, kind === 'image' ? `images/${id}/delete/` : `documents/delete/${id}/`));
});

/**
 * Open the image or document library.
 *
 * Example #1: When I go to the image library
 * Example #2: When I go to the document library
 * Example #3: Given I am on the image library
 * Example #4: Given I am on the document library
 * Example #5: When we go to the image library
 */
When(/^(?:I go to|we go to|I am on|we are on) the (image|document) library$/, async function (kind) {
  await h.open(this, h.adminUrl(this, KINDS[kind].list));
});

/**
 * Search the library on screen with its search box (it swaps its results in, and the step waits for them).
 *
 * Example #1: When I search the image library for "loaf"
 * Example #2: When I search the document library for "Cornbread"
 * Example #3: And we search the image library for "Webship test"
 * Example #4: When I search the document library for "Webship test"
 * Example #5: When I search the image library for "Anadama"
 */
When(/^(?:I|we) search the (image|document) library for "([^"]*)"$/, async function (kind, term) {
  if (!onLibrary(this, kind)) await h.open(this, h.adminUrl(this, KINDS[kind].list));
  await h.searchListing(this, term);
});

/**
 * Show only the items of a collection in the library on screen (the "Collection" filter of "Show filters").
 *
 * Example #1: When I filter the image library by the collection "Other"
 * Example #2: When I filter the document library by the collection "Recipes"
 * Example #3: And we filter the image library by the collection "Bakeries"
 * Example #4: When I filter the image library by the collection "Root"
 * Example #5: When I filter the document library by the collection "Root"
 */
When(/^(?:I|we) filter the (image|document) library by the collection "([^"]*)"$/, async function (kind, collection) {
  const page = this.page;
  if (!onLibrary(this, kind)) await h.open(this, h.adminUrl(this, KINDS[kind].list));
  // "Show filters", then the "Collection" filter of the list that opens, then the collection: the listing swaps
  // its results in, and its address carries the choice (?collection_id=).
  await page.getByRole('button', { name: 'Show filters' }).first().click();
  const drilldown = page.locator('#filters-drilldown');
  await drilldown.getByRole('button', { name: /^Collection\b/ }).first().click();
  const select = drilldown.locator('select[name="collection_id"]').first();
  await select.waitFor({ state: 'visible', timeout: h.budget(this) });
  const options = await select.evaluate((el) => [...el.options].map((o) => ({ value: o.value, text: o.textContent.replace(/[\s↳]+/g, ' ').trim() })));
  const option = options.find((o) => h.normal(o.text) === h.normal(collection));
  if (!option) throw friendly({ message: `The library has no collection "${collection}" to filter by. It has: ${h.listed(options.map((o) => o.text).filter((t) => !/^-+$/.test(t)))}.`, hint: 'Name the collection as the library writes it.' });
  await select.selectOption(option.value);
  await h.eventually(this, () => page.evaluate((id) => {
    const busy = document.querySelector('[aria-busy="true"], [data-w-swap-loading-value="true"]');
    return !busy && new URL(location.href).searchParams.get('collection_id') === id;
  }, option.value), (ok) => ok, async () => ({ message: `The library did not show the collection "${collection}": ${await h.pageSummary(this)}.`, hint: 'The listing swaps its results in when a filter changes; its address then carries ?collection_id=.' }));
  await h.closeDropdown(this);
  await h.pageReady(this);
});

/**
 * Assert that the library on screen (or opened when another page is on screen) lists an item by its title, or
 * does not.
 *
 * Example #1: Then the image library should list "Webship test loaf"
 * Example #2: Then the document library should list "Webship test recipe"
 * Example #3: And the image library should not list "Webship test loaf"
 * Example #4: Then the document library should not list "Webship test recipe"
 * Example #5: Then the image library should list "Muddy Waters"
 */
Then(/^the (image|document) library should( not)* list "([^"]*)"$/, async function (kind, notCase, title) {
  if (!onLibrary(this, kind)) await h.open(this, h.adminUrl(this, KINDS[kind].list));
  await h.pageReady(this);
  const titles = await libraryTitles(this, kind);
  const has = titles.some((t) => h.normal(t) === h.normal(title));
  if (has === !notCase) return;
  throw friendly({
    message: notCase ? `The ${kind} library lists "${title}".` : `The ${kind} library does not list "${title}" on this page. It lists: ${h.listed(titles.slice(0, 25))}.`,
    hint: `A library shows its newest items first, a page at a time: search it first (When I search the ${kind} library for "…").`,
  });
});

/** Open the edit page of an image or a document, by its title (the library's search, then its title). */
async function editItem(world, kind, title) {
  const page = world.page;
  await h.open(world, h.adminUrl(world, `${KINDS[kind].list}?q=${encodeURIComponent(title)}`));
  const link = kind === 'image'
    ? page.locator(`main a.image-choice[title="${title.replace(/"/g, '\\"')}"], main a[title="${title.replace(/"/g, '\\"')}"]`).first()
    : page.locator('main table tbody tr td a').filter({ hasText: h.exactly(title) }).first();
  if (!(await link.count())) {
    throw friendly({ message: `The ${kind} library has no ${kind} "${title}". Its search lists: ${h.listed(await libraryTitles(world, kind))}.`, hint: `Upload it first: When I upload the ${kind} "…" with the title "${title}"` });
  }
  await h.afterNavigation(world, () => link.click());
}

/**
 * Open an image or a document of the library in its edit page, by its title.
 *
 * Example #1: When I edit the image "Webship test loaf"
 * Example #2: When I edit the document "Webship test recipe"
 * Example #3: And we edit the image "Muddy Waters"
 * Example #4: When I edit the document "Cookbook: Skillet Cornbread"
 * Example #5: When I edit the image "Webship test loaf"
 */
When(/^(?:I|we) edit the (image|document) "([^"]*)"$/, async function (kind, title) {
  await editItem(this, kind, title);
});

/**
 * Set the focal point of the image on screen (its edit page) as a person does: a box dragged over the picture,
 * from one corner to the other, each given as a share of the picture's width and height; then "Save".
 *
 * Example #1: When I set the focal point of the image to the area from 55% 40% to 75% 65%
 * Example #2: When I set the focal point of the image to the area from 10% 10% to 30% 30%
 * Example #3: And we set the focal point of the image to the area from 40% 40% to 60% 60%
 * Example #4: When I set the focal point of the image to the area from 0% 0% to 50% 50%
 * Example #5: When I set the focal point of the image to the area from 50% 20% to 90% 80%
 */
When(/^(?:I|we) set the focal point of the image to the area from (\d+)% (\d+)% to (\d+)% (\d+)%$/, async function (x1, y1, x2, y2) {
  const page = this.page;
  const holder = page.locator('.focal-point-chooser .jcrop-holder, .focal-point-chooser').first();
  if (!(await holder.count())) throw friendly({ message: `The page on screen has no focal point chooser: ${await h.pageSummary(this)}.`, hint: 'Open the image first: When I edit the image "…"' });
  await holder.scrollIntoViewIfNeeded();
  const box = await holder.boundingBox();
  const at = (px, py) => [box.x + (box.width * parseInt(px, 10)) / 100, box.y + (box.height * parseInt(py, 10)) / 100];
  const [ax, ay] = at(x1, y1);
  const [bx, by] = at(x2, y2);
  await page.mouse.move(ax + 1, ay + 1);
  await page.mouse.down();
  await page.mouse.move((ax + bx) / 2, (ay + by) / 2, { steps: 5 });
  await page.mouse.move(bx - 1, by - 1, { steps: 5 });
  await page.mouse.up();
  const width = await page.locator('input[name="focal_point_width"]').inputValue().catch(() => '');
  if (!width) throw friendly({ message: 'Dragging over the picture set no focal point.', hint: 'The focal point chooser takes a box dragged over the picture.' });
  await h.afterNavigation(this, () => page.locator('main').getByRole('button', { name: 'Save', exact: true }).first().click());
  await h.expectMessage(this, 'success', 'updated');
});

/**
 * Assert where the focal point of an image is: the centre of its box, as a share of the picture's width and
 * height, within 3 points.
 *
 * Example #1: Then the focal point of the image "Webship test loaf" should be centred at 65% 52%
 * Example #2: Then the focal point of the image "Webship test loaf" should be centred at 20% 20%
 * Example #3: And the focal point of the image "Webship test focal point" should be centred at 50% 50%
 * Example #4: Then the focal point of the image "Webship test loaf" should be centred at 25% 25%
 * Example #5: Then the focal point of the image "Webship test loaf" should be centred at 70% 50%
 */
Then(/^the focal point of the image "([^"]*)" should be centred at (\d+)% (\d+)%$/, async function (title, cx, cy) {
  await editItem(this, 'image', title);
  const fp = await this.page.locator('.focal-point-chooser').first().evaluate((el) => {
    const img = el.querySelector('img');
    const n = (k) => parseFloat(el.getAttribute(`data-focal-point-${k}`));
    return { x: n('x'), y: n('y'), w: img ? parseFloat(img.getAttribute('data-original-width')) : NaN, h: img ? parseFloat(img.getAttribute('data-original-height')) : NaN };
  });
  if (!(fp.x >= 0) || !(fp.w > 0)) throw friendly({ message: `The image "${title}" has no focal point.`, hint: 'Set it first: When I set the focal point of the image to the area from …' });
  const px = (fp.x / fp.w) * 100;
  const py = (fp.y / fp.h) * 100;
  if (Math.abs(px - cx) <= 3 && Math.abs(py - cy) <= 3) return;
  throw friendly({ message: `The focal point of "${title}" is centred at ${px.toFixed(1)}% ${py.toFixed(1)}%, not ${cx}% ${cy}%.`, hint: 'The centre is the middle of the box dragged over the picture.' });
});

/**
 * Assert the collection an image or a document is in (on its edit page).
 *
 * Example #1: Then the image "Webship test loaf" should be in the collection "Other"
 * Example #2: Then the document "Webship test recipe" should be in the collection "Recipes"
 * Example #3: And the image "Webship test loaf" should be in the collection "Root"
 * Example #4: Then the document "Cookbook: Skillet Cornbread" should be in the collection "Recipes"
 * Example #5: Then the image "Muddy Waters" should be in the collection "Root"
 */
Then(/^the (image|document) "([^"]*)" should be in the collection "([^"]*)"$/, async function (kind, title, collection) {
  await editItem(this, kind, title);
  const field = await h.requireField(this, 'Collection', this.page.locator('main'));
  const value = h.clean(await h.fieldValue(field));
  if (h.normal(value) === h.normal(collection)) return;
  throw friendly({ message: `The ${kind} "${title}" is in the collection "${value}", not "${collection}".`, hint: 'The collection is the one its edit page shows.' });
});

/**
 * Delete an image or a document by its title: its edit page, "Delete" in the header's "Actions", then "Yes,
 * delete".
 *
 * Example #1: When I delete the image "Webship test loaf"
 * Example #2: When I delete the document "Webship test recipe"
 * Example #3: And we delete the image "Webship test focal point"
 * Example #4: When we delete the document "Webship test recipe"
 * Example #5: When I delete the image "Webship test loaf"
 */
When(/^(?:I|we) delete the (image|document) "([^"]*)"$/, async function (kind, title) {
  await editItem(this, kind, title);
  await h.headerAction(this, 'Delete');
  await h.confirm(this, /^Yes, delete/);
  await h.expectMessage(this, 'success', 'deleted');
});

/**
 * Add a collection, under another one ("Root" when none is given): Settings › Collections, "Add a collection",
 * its name and its parent, "Create".
 *
 * Example #1: When I add the collection "Webship test collection"
 * Example #2: When I add the collection "Webship test recipes" under "Recipes"
 * Example #3: And we add the collection "Webship test collection"
 * Example #4: When I add the collection "Webship test bakeries" under "Bakeries"
 * Example #5: When I add the collection "Webship test other" under "Other"
 */
When(/^(?:I|we) add the collection "([^"]*)"(?: under "([^"]*)")?$/, async function (name, parent) {
  await h.open(this, h.adminUrl(this, 'collections/add/'));
  await h.setField(this, await h.requireField(this, 'Name', this.page.locator('main')), name);
  await h.setField(this, await h.requireField(this, 'Parent', this.page.locator('main')), parent || 'Root');
  await h.afterNavigation(this, () => this.page.locator('main').getByRole('button', { name: 'Create' }).click());
  await h.expectMessage(this, 'success', 'created');
});

/**
 * Assert that the collections list a collection by its name, or do not.
 *
 * Example #1: Then the collections should list "Webship test collection"
 * Example #2: Then the collections should not list "Webship test collection"
 * Example #3: And the collections should list "Bakeries"
 * Example #4: Then the collections should list "Recipes"
 * Example #5: Then the collections should not list "Webship test recipes"
 */
Then(/^the collections should( not)* list "([^"]*)"$/, async function (notCase, name) {
  await h.open(this, h.adminUrl(this, 'collections/'));
  const names = (await h.listingRows(this.page)).map((r) => r.title || r.text);
  const has = names.some((t) => h.normal(t) === h.normal(name));
  if (has === !notCase) return;
  throw friendly({ message: notCase ? `The collections list "${name}".` : `The collections do not list "${name}". They list: ${h.listed(names)}.`, hint: 'Settings › Collections lists every collection under Root.' });
});

/**
 * Delete a collection by its name (its edit page, "Delete" in the header's "Actions", "Yes, delete"): only an
 * empty collection can go.
 *
 * Example #1: When I delete the collection "Webship test collection"
 * Example #2: When we delete the collection "Webship test recipes"
 * Example #3: And I delete the collection "Webship test collection"
 * Example #4: When I delete the collection "Webship test bakeries"
 * Example #5: When I delete the collection "Webship test other"
 */
When(/^(?:I|we) delete the collection "([^"]*)"$/, async function (name) {
  const page = this.page;
  await h.open(this, h.adminUrl(this, 'collections/'));
  const link = page.locator('main table tbody tr a').filter({ hasText: h.exactly(name) }).first();
  if (!(await link.count())) throw friendly({ message: `There is no collection "${name}".`, hint: 'Name the collection as Settings › Collections lists it.' });
  await h.afterNavigation(this, () => link.click());
  await h.headerAction(this, 'Delete');
  await h.confirm(this, /^Yes, delete/);
  await h.expectMessage(this, 'success', 'deleted');
});
