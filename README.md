<p align="center"><img src="https://raw.githubusercontent.com/webship/wagtail-steps/2.0.x/assets/logo.svg" alt="Wagtail logo" width="96"></p>

# wagtail-steps

[![Test](https://github.com/webship/wagtail-steps/actions/workflows/test.yml/badge.svg)](https://github.com/webship/wagtail-steps/actions/workflows/test.yml)

Cucumber step definitions for Wagtail sites, with [webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD
browser automation harness built on Playwright and Cucumber-js.

Every Wagtail site has the same admin, whatever its pages look like: the login, the dashboard, the page explorer,
the editor with its blocks and its preview, the history of a page, the moderation workflow, the image and document
libraries, snippets, forms, users and groups, redirects and reports. `@webship-js/wagtail-steps` covers them, and
what Wagtail puts on the site itself:

- **the session**: the login page and its refusals (a wrong password, an unknown or an inactive account alike, an
  account without access to the admin, an empty form), logging in by a handle of the users registry or taking over
  an account's session from earlier in the run, logging out, who is signed in, the areas an account may not open,
  and the password reset through the mail;
- **the admin**: the dashboard's panels ("Awaiting your review", "Your pages and snippets in a workflow") and its
  site summary, the sidebar's menus and what each account is offered there, the messages after an action, the
  admin's search;
- **the page explorer**: the tree of the sidebar a level at a time, the listing of a page's children with their
  status and their locks, its search (which swaps its results in), the page types a page may hold, a child page
  added;
- **the editor**: the fields by their labels (the slug following the title), a draft saved, a page published,
  unpublished, submitted for moderation, scheduled to go live later, deleted, the status panel, a lock, the preview
  panel rendering the edits, the autosave of Wagtail 8, the errors of a form;
- **StreamField**: blocks added from the field's own chooser, set by their fields, moved, duplicated and removed,
  and read back in their order;
- **revisions**: the history of a page, a comparison field by field, going back to the live version;
- **the moderation workflow**: a page submitted, sent back with a comment or approved from the dashboard, and the
  mail of each step;
- **the libraries**: images and documents uploaded with their title and collection, found, filtered by
  collection, an image's focal point set by dragging a box over it, collections added and deleted;
- **snippets, forms, users and groups, redirects and reports**: a snippet added and deleted, a form of the form
  builder sent by a visitor and its submission found and deleted in the admin, the access level of the accounts
  and the permissions of a group, a redirect added, followed by the site and deleted, the rows of a report;
- **the site**: its search as a visitor uses it, and the quick actions an account of the admin gets on every page.

No step phrase names the platform: a scenario reads `When I add a "Heading block" block to "Page body"` and
`Then the page "Webship test page" should be awaiting my review`.

CI builds the official Wagtail Bakery demo with [DDEV](https://ddev.com) on the runner, on the current release line
and on the long-term-support one, and runs the suite twice on every push and pull request, then the assertions that
must fail; see [The test site](#the-test-site) and [`.github/workflows/test.yml`](.github/workflows/test.yml).

## From nothing to a green run

What the machine needs: Docker, [DDEV](https://ddev.com), git, Python 3, curl, and Node.js 20 or later with npm. The
site is installed and run in its containers, with the Python of its web image: no Python packages on the machine, no
public domain and no account anywhere.

**1. The site.** The pack's own build script (the one CI runs) makes a DDEV project with the official Wagtail Bakery
demo and its content at the current release (Wagtail 8.1), run the way the demo's production image runs it (see
[The test site](#the-test-site)). It takes about three minutes the first time and two after that.

```bash
git clone https://github.com/webship/wagtail-steps.git
SITE_DIR="$PWD/wagtail-site" wagtail-steps/.github/scripts/build-ddev-site.sh
```

The site answers at `https://wagtailsteps.ddev.site`, its admin at `/admin/`, its mail catcher at
`https://wagtailsteps.ddev.site:8026`. The accounts are `administrator` (a superuser), `editor` (the Editors group),
`moderator` (the Moderators group) and `member` (no access to the admin), each logging in with its user name and the
password `dD.123123ddd`.

In the [Webship Workspace](https://github.com/webship/workspace), its Wagtail plugin builds the same site instead, in a
sites folder of the workspace (`dev/` here, the one `--with-needs` adds to a new workspace; `test/`, `sandboxes/`
and `demos/` work the same):

```bash
bash core/scripts/plugins.sh --require wagtail --with-needs
bash core/scripts/plugins.sh --activate wagtail --with-needs
bash core/scripts/plugins.sh --install wagtail
bash dev/cmd-wagtail-project.sh wagtailsite --install --add-users --bakerydemo
```

That site answers at `https://wagtailsite.ddev.site`. Its accounts are the plugin's: the same four, at
`example.com`, with the workspace's shared password `dD.123123ddd`, and the workspace account as its superuser.
Without `--bakerydemo` the builder makes a new project with `wagtail start` instead; the plugin's README says how to
manage the site and its accounts with its tool (`cmd-tools-wagtail-manage.sh wagtailsite --add-users`).

**2. A test project.**

```bash
mkdir wagtail-tests && cd wagtail-tests
npm init -y
npm install --save-dev webship-js @webship-js/wagtail-steps
npx init-webship-js
```

`npx init-webship-js` writes `cucumber.js`, `playwright.config.ts`, the `tests/` folders with a first feature and the
`npm test` scripts, and installs Chromium. npm usually runs it already when it installs webship-js; a second run
changes nothing. Its first feature opens the site's home page: it passes, and can stay.

**3. `cucumber.js`.** Replace the file with the wiring of the pack: the step files of webship-js and of the pack,
the tags that keep the assertions that must fail out of a normal run, where the admin is, the mail catcher, the
browser messages to ignore, and the accounts (the JSON of [Test users](#test-users)). The first lines are the
starter's own: a feature named on the command line runs alone (step 5).

```javascript
// A feature file or a scenario (file:line) named on the command line runs alone:
// cucumber-js 12 would add it to the paths below, so `paths` is left empty then.
const OPTIONS_WITH_A_VALUE = new Set([
  '-c', '--config', '-f', '--format', '--format-options', '--i18n-keywords',
  '-i', '--import', '-l', '--loader', '--language', '--name', '--order',
  '-p', '--profile', '--parallel', '--plugin', '--plugin-options',
  '-r', '--require', '--require-module', '--retry', '--retry-tag-filter',
  '--shard', '-t', '--tags', '--world-parameters',
]);

function commandLinePaths() {
  if (!/cucumber(-js|\.js)?$/.test(String(process.argv[1] || ''))) return [];
  const args = process.argv.slice(2);
  const paths = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('-')) {
      if (OPTIONS_WITH_A_VALUE.has(args[i])) i += 1;
    } else {
      paths.push(args[i]);
    }
  }
  return paths;
}

const launchUrl = (process.env.LAUNCH_URL || 'https://wagtailsteps.ddev.site').replace(/\/+$/, '');

module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',
      'node_modules/@webship-js/wagtail-steps/tests/step-definitions/**/*.js',
      'tests/step-definitions/**/*.js',
    ],
    paths: commandLinePaths().length ? [] : ['tests/features/**/*.feature'],
    // Work in progress and the assertions that must fail stay out of a normal run.
    tags: 'not @wip and not @must-fail',
    format: ['@cucumber/pretty-formatter', 'json:tests/reports/cucumber_report.json'],
    worldParameters: {
      launchUrl,
      // Where the admin is, and the mail catcher the site sends its mail to.
      adminPath: '/admin/',
      mailUrl: `${launchUrl}:8026`,
      // Browser messages: the admin's accessibility checker writes its findings to the console as errors
      // ("axe.run results"), which are about the content, not faults of the site: they are ignored. The browser
      // also logs every error page it gets ("Failed to load resource: … 404"): the scenarios that open one carry
      // @js-off.
      javascript: { mode: 'warn', levels: ['error'], ignore: 'axe\\.run results', beforeScenario: false, afterScenario: true },
      minWaitTime: { page: 3000, before_scenario: 0, after_scenario: 0, before_step: 0, after_step: 0 },
      users: {
        administrator: { username: 'administrator', password: 'dD.123123ddd', email: 'administrator@example.com' },
        editor: { username: 'editor', password: 'dD.123123ddd', email: 'editor@example.com' },
        moderator: { username: 'moderator', password: 'dD.123123ddd', email: 'moderator@example.com' },
        member: { username: 'member', password: 'dD.123123ddd', email: 'member@example.com' },
      },
    },
  },
};
```

On the site from the Webship Workspace (step 1) the accounts and the paths are the same; its address goes in
`LAUNCH_URL` (step 5), and the mail catcher follows it.

**4. A first feature**, `tests/features/first-run.feature`:

```gherkin
Feature: First run
  Scenario: A visitor is sent to the login page, and the editor logs in to its own work
    Given I am not logged in
    When I go to "/admin/pages/"
    Then I should be on the login page
    When I log in as "editor" with the login form
    Then I should be logged in as "editor"
    And the "Settings" menu should not offer "Users"

  Scenario: The moderator's dashboard shows what awaits its review
    Given I am a logged in user with the "moderator" user
    When I go to the dashboard
    Then the dashboard should show the panel "Awaiting your review"
    And the panel "Awaiting your review" should list "Southern Cornbread"
```

**5. Run it.** Set `LAUNCH_URL` to the address of the site: `https://wagtailsteps.ddev.site` for the build
script's site, `https://wagtailsite.ddev.site` for the Workspace's.

```bash
LAUNCH_URL=https://wagtailsteps.ddev.site npm test
```

A green first run prints every step, then the summary (the scenarios above and the starter's, passed) and the HTML
report it wrote:

```
3 scenarios (3 passed)
12 steps (12 passed)
0m09.812s (executing steps: 0m09.774s)
[webship-js] HTML report → …/wagtail-tests/tests/reports/cucumber_report.html
```

One feature runs alone when the command line names it (a scenario too, with its line):

```bash
LAUNCH_URL=https://wagtailsteps.ddev.site npx cucumber-js tests/features/first-run.feature
```

From there, copy the features of [`tests/features/`](tests/features/) (they also ship in the package, under
`node_modules/@webship-js/wagtail-steps/tests/features/`). They use every step of the pack, run as they are on the
site of either way of step 1, and take away what they make; the image and the document they upload ship with the
package too (`tests/fixtures/`). One of them, `editing.feature`, has a scenario of the autosave of Wagtail 8
(`@autosave`): leave it out on an older release (`--tags "not @autosave"`).

For your own site, point `launchUrl` at it, `adminPath` at its admin, `mailUrl` at the mail catcher its mail goes to,
and `users` at its test accounts (`username` and `password`; `email` for the mail steps and for "I should be logged in
as"). The steps read what Wagtail draws the same way on every site; your site's own pages and templates are read
with webship-js's `I should see "…"`.

### What the suite tests

The features of this repository run every step of the pack against the Wagtail Bakery demo, on two release lines,
twice in a row in CI on every change:

- `tests/features/` (55 scenarios): the login of each account, the refusals (a wrong password, an unknown and an
  inactive account in the same words, an empty form, an account without access to the admin), the logout, a session
  taken over; the password reset through its mail and its link, and no mail for an unknown address; the dashboard of
  each account, its panels and its site summary, the menus each account is offered, the admin's search, the areas an
  editor is refused; the page explorer, its count, its statuses and its locks, its search, the tree of the sidebar,
  the page types a page may hold; a page written with blocks, previewed, saved, published, read on the site and
  deleted; blocks moved, duplicated and removed; a live page unpublished; a page scheduled to go live in 2030; a
  required field refused; the autosave of the editor; the history, a comparison with the live version, a page put
  back to its live version; a lock seen by another account and in the locked pages report; the whole moderation
  workflow (submitted, sent back with a comment, resubmitted, approved, published) with the mail of each step; an
  image uploaded to a collection, filtered, given a focal point and deleted; a document uploaded, searched and
  deleted; a collection added and deleted; an upload by the editor; a snippet added and deleted, with the listing's
  count; the contact form sent by a visitor, its mail, and its submission found and deleted; the browser keeping an
  incomplete form from being sent; the users list and the permissions of the groups; a redirect added, followed and
  deleted, the demo's own redirects, a redirect to an address that is not whole refused; four reports; the site's
  search, its 404, and the quick actions of an account of the admin;
- `tests/must-fail/` (42 scenarios): an assertion that is not true for each kind of step, which must fail with its
  message and a hint.

Not tested: the comments of the editor, page privacy (a page behind a password), the translations of a page (the
demo has German and Arabic locales), copying and moving pages, bulk actions, the image chooser of a page's image
field, embeds, the API, and admin languages other than English (the steps read the admin's words: "Save draft",
"Awaiting your review", "Yes, delete").

## Requirements

- Node.js 20 or later
- A webship-js 2.0 test project (webship-js 2.0.16 or later)
- A Wagtail site (the steps hold on Wagtail 8.1 and on the long-term-support Wagtail 7.4), its accounts for the
  suite, and a mail catcher for the mail steps

## Install

```bash
npm install --save-dev @webship-js/wagtail-steps
```

## The test site

[`.github/scripts/build-ddev-site.sh`](.github/scripts/build-ddev-site.sh) builds the site the suite of this
repository runs against:

- the official [Wagtail Bakery demo](https://github.com/wagtail/bakerydemo) (BSD-3-Clause), the project Wagtail keeps
  to show its features, at the commit that last ran on the release line asked for (`WAGTAIL_VERSION`: 8.1, the
  current one, by default; 7.4, the long-term-support one), with its demo content (34 pages, 39 images, 2 documents,
  the snippets, a contact form, redirects, the "Moderators approval" workflow) loaded by its own `load_initial_data`;
- a generic DDEV project whose web container runs the site with uWSGI (the server of the demo's production image,
  from its binary wheel) as a daemon, the router of DDEV sending the project's address to it; PostgreSQL 16 from DDEV;
  the mail catcher of DDEV for the site's mail; Node.js 24 for a suite run in the container;
- uv and the Python the demo runs on (3.12) in the web image, and the packages in a virtual environment of the
  project;
- the demo's production settings (DEBUG off: its own 404 and 500 pages; its static files collected and served
  compressed), with what a deployment adds, written by [`site/wagtail-site.py`](site/wagtail-site.py) into
  `bakerydemo/settings/container.py`: the database of the project, the router's HTTPS, the address of the admin's
  links, and the mail sent over SMTP to the mail catcher instead of the console; the demo's site answering at the
  project's address;
- the accounts of [Test users](#test-users), made through the site's own user model: `administrator` is new,
  `editor` and `moderator` are the demo's own accounts (Eddy Thorsørensen and Jordan Rules), given that password,
  and `member` is new. The demo's other accounts (`admin`, `inactive`, `german`, `arabic`) keep the demo's password.

Run again with `ACCOUNTS_ONLY=1` and the same `SITE_DIR`, the build script puts the accounts back as they were made;
with `TIDY_ONLY=1` it removes what a run that was stopped half way left (the test content is titled "Webship test …").

## How the steps find things and wait

- **By what a person reads.** A field by its label (its required mark aside; a field on another tab of the editor
  opens that tab), a button or an action by its words, a page by its title (the admin's own page search finds it), a
  block by its place in its field, a menu item by its name, a row by the title it holds, an account by a handle of
  the users registry. What Wagtail draws the same way on every site is the fallback: the regions of the editor's
  panels, the status side panel (`[data-side-panel="status"]`), the blocks of a StreamField (`[data-streamfield-child]`
  and their `Move up`, `Move down`, `Duplicate`, `Delete` buttons), the messages (`.messages li.success`, `.error`,
  `.warning`), the sidebar's description of its menus (`#wagtail-sidebar-props`).
- **The site's own signals, no fixed sleeps.** The admin is drawn on the server and worked on by its own scripts. A
  step that acts waits for the page it leads to; a listing's search waits for the results it swaps in (they are
  `aria-busy` until then, and the address carries the search); a dropdown is used once its menu has shown; the editor
  is used once it has taken its first picture of its form ("watch-edits"), and an action of the editor waits for the
  editor's own save to finish first (Wagtail 8 saves a draft by itself a moment after a field changes: the form then
  holds no edit its autosave has not saved, and the indicator does not say "Saving…"); a field is left after it is set,
  so the page's own scripts follow (the slug follows the title); the preview is read once it is not loading; an upload
  waits for the row of its file to say it is complete.
- **Who is signed in** is asked of the admin itself: a step reads the email address its account page shows, with the
  cookies of the browser, and the page on screen stays as it is.
- **The mail** is read from the mail catcher's API (`mailUrl`, a Mailpit): only the mail that came since the scenario
  began.
- **Test content comes and goes.** A scenario names what it makes "Webship test …", starts from a site without it
  (`Given there is no page "…"`, and the other kinds), and deletes it; what it uploaded is deleted after it when it did
  not get to that itself.
- **Failures say what was found.** `The page explorer does not list "Sourdough". It lists: "About", "Contact Us", …`,
  `The editor does not offer "Publish". It offers: "Save draft", "Submit to Moderators approval".`, with a hint on where
  to look.

## Accounts

The suite never creates or deletes an account. Accounts are configuration: list the ones the site has in
`worldParameters.users`, by a handle the scenarios use, each with its `username` and `password`, and its `email` for
the mail steps and for "I should be logged in as". An account that logged in once keeps its session for the rest of
the run (`reuseSessions: false` turns it off); a logout ends it.

## Test users

The accounts this repository's suite logs in as, exactly as `cucumber.js` lists them in `worldParameters.users` (the
default values; the `<HANDLE>_PASSWORD` variables replace them). The build script makes them; the Workspace's Wagtail
plugin makes the same four.

```json
{
  "administrator": { "username": "administrator", "password": "dD.123123ddd", "email": "administrator@example.com" },
  "editor": { "username": "editor", "password": "dD.123123ddd", "email": "editor@example.com" },
  "moderator": { "username": "moderator", "password": "dD.123123ddd", "email": "moderator@example.com" },
  "member": { "username": "member", "password": "dD.123123ddd", "email": "member@example.com" }
}
```

`administrator` is a superuser. `editor` is in the Editors group: it adds and changes pages, uploads images and
documents, and submits pages for moderation. `moderator` is in the Moderators group: it also publishes, locks and
unlocks pages, and reviews what is submitted. `member` is an account of the site with no access to the admin: the
login refuses it. They are accounts of a throwaway test site, with a placeholder password, not accounts of any real
one.

## Steps

### `wagtail-session.steps.js` (13)

- `Given I am a logged in user with the "editor" user`
- `When I log in as "editor" with the login form`
- `When I try to log in as "member" with the login form`
- `When I log in with the username "nobody" and the password "Wrong-password-1"`
- `Then the login should be refused with "Your username and password didn't match. Please try again."`
- `Given I am not logged in`
- `When I log out`
- `Then I should be logged in as "editor"`
- `Then I should be logged in`
- `Then I should be on the login page`
- `Then I should not be allowed to open "/admin/users/"`
- `When I ask for a password reset link for "editor"`
- `When I set the password of "editor" on the reset page`

### `wagtail-admin.steps.js` (11)

- `Given I am on the dashboard`
- `Then the dashboard should show the panel "Awaiting your review"`
- `Then the panel "Awaiting your review" should list "Southern Cornbread"`
- `Then the site summary should count 34 pages`
- `When I open "Bread types" from the "Breads" menu`
- `When I open "Images" from the main menu`
- `Then the main menu should offer "Settings"`
- `Then the "Settings" menu should offer "Users"`
- `Then I should see the success message "Page 'Webship test page' has been published."`
- `When I search the admin for "bread"`
- `Then the admin search should find the page "Anadama"`

### `wagtail-explorer.steps.js` (13)

- `When I go to the page explorer of "Breads"`
- `Then the page explorer should list "About"`
- `Then the page explorer should count 7 pages`
- `When I search the page explorer for "bread"`
- `Then the page "About" should have the status "live"`
- `Then the page "Contact Us" should be shown as locked`
- `When I explore the child pages of "Breads"`
- `When I add a "Standard page" under the home page`
- `Then the home page should offer the page type "Standard page"`
- `When I edit the page "About"`
- `When I open the page tree`
- `When I open the home page in the page tree`
- `Then the page tree should show "Breads"`

### `wagtail-editor.steps.js` (16)

- `When I set "Title" to "Webship test page"`
- `When I set these fields:`
- `Then "Title" should be set to "Webship test page"`
- `When I save the draft`
- `When I publish the page`
- `When I unpublish the page`
- `When I submit the page for moderation`
- `When I choose "Publish" in the editor`
- `Then the editor should offer "Publish"`
- `When I delete the page "Webship test page"`
- `Then the status panel should say "Draft"`
- `When I schedule the page to go live at "2030-01-01 09:00"`
- `When I lock the page`
- `Then the preview should show "Webship test page"`
- `Then the edits should be saved by themselves`
- `Then the "Slug" field should have the error "This field is required."`

### `wagtail-streamfield.steps.js` (6)

- `When I add a "Heading block" block to "Page body"`
- `When I set "Heading text" to "Our oven" in block 1 of "Page body"`
- `When I move block 2 of "Page body" up`
- `When I remove block 1 of "Page body"`
- `Then "Page body" should have 2 blocks`
- `Then the blocks of "Page body" should be "Heading block", "Paragraph block"`

### `wagtail-revisions.steps.js` (6)

- `When I open the history of the page "Webship test page"`
- `Then the history should list "Published"`
- `Then the newest entry of the history should be "Draft saved"`
- `When I compare the live version with the current draft`
- `Then the comparison should show "Introduction" changed from "First" to "Second"`
- `When I revert the page to the live version`

### `wagtail-workflow.steps.js` (3)

- `When I approve the page "Webship test page"`
- `Then my page "Webship test page" should be "Awaiting Moderators approval"`
- `Then the page "Webship test page" should be awaiting my review`

### `wagtail-media.steps.js` (13)

- `When I upload the image "webship-test-loaf.png" with the title "Webship test loaf"`
- `When I go to the image library`
- `When I search the image library for "loaf"`
- `When I filter the image library by the collection "Other"`
- `Then the image library should list "Webship test loaf"`
- `When I edit the image "Webship test loaf"`
- `When I set the focal point of the image to the area from 55% 40% to 75% 65%`
- `Then the focal point of the image "Webship test loaf" should be centred at 65% 52%`
- `Then the image "Webship test loaf" should be in the collection "Other"`
- `When I delete the image "Webship test loaf"`
- `When I add the collection "Webship test collection"`
- `Then the collections should list "Webship test collection"`
- `When I delete the collection "Webship test collection"`

### `wagtail-snippets.steps.js` (6)

- `When I go to the "Bread types" snippets`
- `When I add to the "Bread types" snippets:`
- `Then the "Bread types" snippets should list "Webship test bread type"`
- `Then the "Bread types" snippets should count 17`
- `When I delete "Webship test bread type" from the "Bread types" snippets`
- `Given there is no "Webship test bread type" in the "Bread types" snippets`

### `wagtail-forms.steps.js` (6)

- `When I send the form of this page with:`
- `Then the form of this page should not be sent for "Subject"`
- `When I go to the submissions of the form "Contact Us"`
- `Then the submissions should list "Webship test message"`
- `Then the submissions should have the columns "Submission date", "Subject", "Your Name", "Your Email", "Purpose", "Body"`
- `When I delete the submission "Webship test message"`

### `wagtail-users.steps.js` (3)

- `Then the users list should show "administrator" with the access level "Admin"`
- `Then the group "Editors" should be allowed to "Edit" the pages under "Root"`
- `Then the group "Editors" should have the permission "Can add footer text"`

### `wagtail-redirects.steps.js` (4)

- `When I add a temporary redirect from "/webship-test-old-bread" to the page "Breads"`
- `Then the redirects should list "/webship-test-old-bread" to "Breads"`
- `Then "/webship-test-old-bread" should redirect to "/breads/"`
- `When I delete the redirect "/webship-test-old-bread"`

### `wagtail-reports.steps.js` (3)

- `When I open the "Locked pages" report`
- `Then the report should list "Contact Us"`
- `Then the report row "Contact Us" should show "Locked by admin" in the "Locking status" column`

### `wagtail-site.steps.js` (4)

- `When I search the site for "bread"`
- `Then the search results should list "Anadama"`
- `Then I should see the quick actions of the admin`
- `When I choose "Edit this page" from the quick actions`

### `wagtail-mail.steps.js` (4)

- `Then an email with the subject "Password reset" should be sent to "editor"`
- `Then no email should be sent to "nobody@example.com"`
- `Then the email with the subject "has been rejected" to "editor" should contain "Please add a photo."`
- `When I open the link of the email with the subject "Password reset" to "editor"`

### `wagtail-content.steps.js` (1)

- `Given there is no page "Webship test page"`

Text, links, buttons, fields, tabs and status codes are webship-js's own steps (`I should see "…"`, `I press "…"`,
`I go to "…"`, `I click the "Promote" tab`, `the response status code should be 404`); this pack adds what Wagtail
decides. Some steps take more than their first example shows: `I approve the page "…" with the comment "…"` and
`I request changes to the page "…" with the comment "…"`, `I unlock the page`, `I duplicate block 1 of "…"`,
`I add a permanent redirect from "…" to "https://example.com/"`, `the users list should show "member" as active`,
`there is no image "…"` (and `document`, `redirect`, `collection`); the JSDoc of each step lists five.

## Phrases shared with other packs

The session phrases are the ones every platform pack has, so a feature reads the same on every system (one
`cucumber.js` profile per system; the platform packs are not meant to be loaded together). Loaded beside each of the
38 published packs, these phrases of this pack also match one of theirs:

| Phrase of this pack | Also in |
| --- | --- |
| `I am a logged in user with the "…" user` | aspnet-core, codeigniter, discourse, django, django-cms, drupal-core, joomla, keycloak, laravel, mediawiki, moodle, nextcloud, nextjs, odoo, payload, spring-boot, strapi, symfony, typo3, wordpress |
| `I log out` | aspnet-core, codeigniter, discourse, django, django-cms, drupal-core, keycloak, laravel, mediawiki, moodle, nextcloud, nextjs, odoo, payload, spring-boot, strapi, symfony, typo3, wordpress |
| `I should be logged in` | aspnet-core, codeigniter, discourse, django, django-cms, drupal-core, keycloak, laravel, mediawiki, moodle, nextcloud, nextjs, odoo, payload, spring-boot, strapi, symfony, typo3, wordpress |
| `I should be logged in as "…"` | aspnet-core, backdrop-cms, codeigniter, discourse, django, keycloak, laravel, mediawiki, moodle, nextcloud, nextjs, odoo, payload, spring-boot, strapi, symfony, typo3 |
| `I am not logged in` | aspnet-core, discourse, django, django-cms, drupal-core, joomla, keycloak, nextcloud, odoo, payload, spring-boot, strapi, typo3, wordpress |
| `I log in as "…" with the login form` | aspnet-core, codeigniter, discourse, django, keycloak, laravel, mediawiki, moodle, nextcloud, nextjs, payload, spring-boot, strapi, symfony |
| `I should see the success message "…"` | codeigniter, django, drupal-core, jira, joomla, magento, moodle, prestashop, spring-boot, symfony, woocommerce |
| `I search the site for "…"` | backdrop-cms, ghost, hubspot-cms, jira, joomla, payload, squarespace, typo3, wordpress |
| `the login should be refused with "…"` | aspnet-core, discourse, django, keycloak, mediawiki, nextcloud, payload, spring-boot, strapi |
| `I log in with the username "…" and the password "…"` | aspnet-core, discourse, keycloak, moodle, nextcloud, spring-boot, symfony |
| `I should not be allowed to open "…"` | aspnet-core, discourse, django, django-cms, payload, spring-boot, strapi |
| `no email should be sent to "…"` | aspnet-core, codeigniter, keycloak, laravel, nextcloud, symfony, woocommerce |
| `I should be on the login page` | aspnet-core, discourse, keycloak, nextcloud, spring-boot, wordpress |
| `an email with the subject "…" should be sent to "…"` | aspnet-core, codeigniter, keycloak, laravel, symfony, woocommerce |
| `the "…" field should have the error "…"` | aspnet-core, craft-cms, keycloak, laravel, spring-boot, symfony |
| `the email with the subject "…" to "…" should contain "…"` | aspnet-core, codeigniter, keycloak, laravel, symfony, woocommerce |
| `"…" should be set to "…"` | django, filament, payload, strapi |
| `I ask for a password reset link for "…"` | aspnet-core, keycloak, laravel, nextcloud |
| `I set "…" to "…"` | django, filament, payload, strapi |
| `I set these fields:` | django, filament, payload, strapi |
| `I publish the page` | django-cms, ghost, wordpress |
| `the preview should show "…"` | craft-cms, ghost, mediawiki |
| `I unpublish the page` | django-cms, ghost |
| `the editor should offer "…"` | ghost, wordpress |
| `I am on the dashboard` | drupal-cms |
| `I edit the page "…"` | mediawiki |
| `I go to the dashboard` | nextcloud |
| `I open the history of the page "…"` | mediawiki |
| `I search the admin for "…"` | ghost |
| `the history should list "…"` | django |
| `the search results should list "…"` | backdrop-cms |
| `there is no page "…"` | magento |

None matches a webship-js step, and none matches a phrase of the component pack (Bootstrap) or of the Diffy pack,
which can be loaded beside this one. The Django admin pack (`@webship-js/django-steps`) works on the admin Django
ships (`/django-admin/` on the demo), which Wagtail's own admin replaces: the two share their session phrases and
`I set "…" to "…"`, and this pack does not depend on it.

## Testing this package

```bash
npm ci
npm run test:examples    # every step's JSDoc examples match it and nothing else; every feature step resolves
npm run test:paths       # a feature named on the command line runs alone
npx cucumber-js --dry-run
SITE_DIR="$PWD/../wagtail-site" .github/scripts/build-ddev-site.sh
npx cucumber-js          # the whole suite
npm run test:must-fail   # the assertions that must fail, each with its message and a hint
WAGTAIL_VERSION=7.4 SITE_DIR="$PWD/../wagtail-site" .github/scripts/build-ddev-site.sh
CUCUMBER_TAGS='not @wip and not @must-fail and not @autosave' npx cucumber-js
```

## How the steps were written

Every step was written from a round of manual testing of the real local site in the browser first: each screen it
touches was opened as the account the step works as, its roles, labels and messages noted, and the signal it gives
while it loads or saves found (the swap of a listing, the editor's autosave and its first picture of the form, the
fade-in of a dropdown, the debounce of the slug, the row of an upload). The failures of the first runs went back to
the browser before the step changed: the slug left empty by a title typed too early, a draft saved twice when the
autosave and the button raced, a heading block that shows nothing until its size is chosen, a lock told as
information rather than a success, the people of the demo in the collection "Other".

## License

MIT, see [LICENSE](LICENSE).

## Logo

The logo in this README is the Wagtail logo from Simple Icons 16.37.0 (CC0-1.0), filled with the colour the set lists
for the brand. The Wagtail name and logo are trademarks of their owner; this pack is not affiliated with or endorsed by
them.
