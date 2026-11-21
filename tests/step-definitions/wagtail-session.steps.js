'use strict';

// The session: logging in to the admin by a handle of the users registry or
// with a user name and a password, the refusals of the login form, logging
// out, who is signed in, the pages an account may not open, and the password
// reset the login page offers.
//
// Accounts are configuration, not test data: they are listed in cucumber.js
// (`worldParameters.users`) and made once by the build of the site. A feature
// never creates or deletes an account.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./wagtail-helpers');

/**
 * Log in to the admin as an account of the users registry (`worldParameters.users` in cucumber.js), by its
 * handle. An account that logged in earlier in the run takes its session over; otherwise the step logs in
 * through the login form. The step ends on the dashboard.
 *
 * Example #1: Given I am a logged in user with the "editor" user
 * Example #2: Given we are a logged in user with the "administrator" user
 * Example #3: Given I am a logged in user with "moderator"
 * Example #4: And I am a logged in user with the "moderator" user
 * Example #5: Given we are a logged in user with the "editor" user
 */
Given(/^(I am |we are )*a logged in user with( the)* "([^"]*)"( user)*$/, { timeout: 120000 }, async function (pronounCase, theCase, handle, userCase) {
  await h.logInAs(this, handle);
});

/**
 * Log in through the admin login form as an account of the users registry, as a person does: a new session,
 * never one taken over. For the scenarios that test the form itself; the step fails when the admin refuses the
 * login.
 *
 * Example #1: When I log in as "editor" with the login form
 * Example #2: When we log in as "moderator" with the login form
 * Example #3: And I log in as "administrator" with the login form
 * Example #4: When I log in as "moderator" with the login form
 * Example #5: Then we log in as "editor" with the login form
 */
When(/^(I |we )*log in as "([^"]*)" with the login form$/, { timeout: 120000 }, async function (pronounCase, handle) {
  const user = h.resolveUser(this, handle);
  // The page asked for before the login (its ?next=) is kept: a visitor sent to the login page goes back to it.
  const onLogin = (await h.loginForm(this.page).username.count()) > 0;
  const outcome = await h.submitLogin(this, user.username, user.password, { fresh: !onLogin });
  if (!outcome.ok) {
    throw friendly({
      message: `The login form refused "${handle}" (${user.username}): ${h.listed(outcome.errors)}.`,
      hint: outcome.cut ? h.CUT_HINT : 'Check the user name and the password of the account in worldParameters.users, and that the build of the site gave it access to the admin.',
    });
  }
  this.__wagtailUser = user;
});

/**
 * Try to log in through the admin login form as an account of the users registry, without expecting the login
 * to succeed (an account the admin refuses: one without access to the admin, an inactive one): assert the
 * outcome with the next step. No password is written in the feature.
 *
 * Example #1: When I try to log in as "member" with the login form
 * Example #2: When we try to log in as "member" with the login form
 * Example #3: And I try to log in as "editor" with the login form
 * Example #4: When I try to log in as "moderator" with the login form
 * Example #5: When we try to log in as "administrator" with the login form
 */
When(/^(I |we )*try to log in as "([^"]*)" with the login form$/, { timeout: 120000 }, async function (pronounCase, handle) {
  const user = h.resolveUser(this, handle);
  const onLogin = (await h.loginForm(this.page).username.count()) > 0;
  const outcome = await h.submitLogin(this, user.username, user.password, { fresh: !onLogin });
  this.__loginOutcome = outcome;
  if (outcome.ok) this.__wagtailUser = user;
});

/**
 * Send the admin login form with a user name and a password. The step does not expect the login to succeed:
 * assert the outcome with the next step.
 *
 * Example #1: When I log in with the username "nobody" and the password "Wrong-password-1"
 * Example #2: When we log in with the username "editor" and the password "Not-the-password-2"
 * Example #3: And I log in with the username "member" and the password "dD.123123ddd"
 * Example #4: When I log in with the username "" and the password ""
 * Example #5: When we log in with the username "inactive" and the password "changeme"
 */
When(/^(I |we )*log in with the username "([^"]*)" and the password "([^"]*)"$/, { timeout: 120000 }, async function (pronounCase, username, password) {
  const onLogin = (await h.loginForm(this.page).username.count()) > 0;
  const outcome = await h.submitLogin(this, username || '', password || '', { fresh: !onLogin });
  this.__loginOutcome = outcome;
  if (outcome.ok) this.__wagtailUser = h.accountOf(this, username);
});

/**
 * Assert that the login page refused the login with an error (or a part of it), and that nobody got into the
 * admin. The admin writes one error for a wrong password, an unknown user name and an inactive account alike,
 * another for an account that may not use the admin, and "This field is required." under an empty field.
 *
 * Example #1: Then the login should be refused with "Your username and password didn't match. Please try again."
 * Example #2: Then the login should be refused with "You do not have permission to access the admin."
 * Example #3: And the login should be refused with "didn't match"
 * Example #4: Then the login should be refused with "This field is required."
 * Example #5: Then the login should be refused with "Please try again."
 */
Then(/^the login should be refused with "([^"]*)"$/, async function (expected) {
  const page = this.page;
  const onLogin = (await h.loginForm(page).username.count()) > 0;
  const errors = [...(await h.messages(page, 'error')), ...(await h.fieldErrors(page)).map((e) => e.text)];
  if (!onLogin || !errors.some((e) => h.mentions(e, expected))) {
    throw friendly({
      message: !onLogin
        ? `The login was not refused: ${await h.pageSummary(this)}.`
        : `The login page did not refuse the login with "${expected}". Its errors: ${h.listed(errors)}.`,
      hint: h.hintFor(this, 'Send the form first (When I log in with the username "..." and the password "..."); the admin writes its error above the form, or under an empty field.'),
    });
  }
});

/**
 * Start as a visitor of the admin: no session (the cookies of the browser cleared), on the admin login page.
 *
 * Example #1: Given I am not logged in
 * Example #2: Given we are not logged in
 * Example #3: And I am not logged in
 * Example #4: Given I am not logged in
 * Example #5: When we are not logged in
 */
Given(/^(I am |we are )*not logged in$/, async function (pronounCase) {
  await this.page.context().clearCookies();
  h.forgetSession(this);
  this.__wagtailUser = null;
  await h.open(this, h.adminUrl(this, 'login/'));
});

/**
 * Log out as a person does: "Log out" in the account menu at the foot of the sidebar (a form the admin sends
 * with POST), then the login page with "You have been successfully logged out.". On a page that is not the
 * admin's, the step opens the dashboard first.
 *
 * Example #1: When I log out
 * Example #2: When we log out
 * Example #3: And I log out
 * Example #4: Then I log out
 * Example #5: Given I log out
 */
When(/^(I |we )*log out$/, { timeout: 90000 }, async function (pronounCase) {
  const page = this.page;
  h.forgetSession(this, this.__wagtailUser && this.__wagtailUser.username);
  if (!h.onAdmin(this) || (await h.loginForm(page).username.count())) await h.open(this, h.adminUrl(this));
  const form = page.locator('form[action$="/logout/"]').first();
  if (!(await form.count())) {
    this.__wagtailUser = null;
    return; // nobody is signed in
  }
  // The account menu at the foot of the sidebar holds "Log out".
  const account = page.locator('aside button[aria-haspopup="menu"]').last();
  if ((await account.count()) && (await account.getAttribute('aria-expanded')) !== 'true') await account.click();
  const button = form.locator('button[type="submit"]').first();
  await button.waitFor({ state: 'visible', timeout: h.budget(this) }).catch(() => {});
  await h.afterNavigation(this, () => button.click());
  this.__wagtailUser = null;
  await h.expectMessage(this, 'any', 'logged out', 'The admin answers a logout with its login page and "You have been successfully logged out.".');
});

/**
 * Assert who is signed in to the admin: a handle of the users registry (its email address, else its user
 * name), an email address or a user name. The step asks the admin's account page with the cookies of the
 * browser; the page on screen stays as it is.
 *
 * Example #1: Then I should be logged in as "editor"
 * Example #2: Then we should be logged in as "administrator"
 * Example #3: And I should be logged in as "moderator"
 * Example #4: Then I should be logged in as "editor@example.com"
 * Example #5: And we should be logged in as "moderator"
 */
Then(/^(I |we )*should be logged in as "([^"]*)"$/, async function (pronounCase, who) {
  const user = h.accountOf(this, who);
  const found = await h.signedInAccount(this);
  if (!h.isAccount(found, user)) {
    throw friendly({
      message: found ? `The admin's account page belongs to ${found.email || found.name}, not to "${who}"${user.email ? ` (${user.email})` : ''}.` : `Nobody is logged in to the admin: its account page sends the browser to the login page.`,
      hint: h.hintFor(this, 'Log in first: Given I am a logged in user with the "editor" user'),
    });
  }
});

/**
 * Assert that someone is, or nobody is, logged in to the admin (its account page opens, or sends the browser
 * to the login page). The page on screen stays as it is.
 *
 * Example #1: Then I should be logged in
 * Example #2: Then I should not be logged in
 * Example #3: And we should be logged in
 * Example #4: And we should not be logged in
 * Example #5: Then I should not be logged in
 */
Then(/^(I |we )*should( not)* be logged in$/, async function (pronounCase, notCase) {
  const found = await h.signedInAccount(this);
  if (notCase && found) {
    throw friendly({ message: `Someone is logged in to the admin: ${found.email || found.name}.`, hint: 'Log out first: When I log out' });
  }
  if (!notCase && !found) {
    throw friendly({ message: 'Nobody is logged in to the admin: its account page sends the browser to the login page.', hint: h.hintFor(this, 'Log in first: Given I am a logged in user with the "editor" user') });
  }
});

/**
 * Assert that the page is the admin login page (the form with "Username" and "Password" a visitor is sent
 * to), with the page asked for kept for after the login when there was one.
 *
 * Example #1: Then I should be on the login page
 * Example #2: Then we should be on the login page
 * Example #3: And I should be on the login page
 * Example #4: Then I should be on the login page
 * Example #5: And we should be on the login page
 */
Then(/^(I |we )*should be on the login page$/, async function (pronounCase) {
  await h.eventually(this, async () => (await h.loginForm(this.page).username.count()) > 0, (on) => on, async () => ({
    message: `The page is not the admin login page: ${await h.pageSummary(this)}.`,
    hint: h.hintFor(this, 'A visitor who opens a page of the admin is sent to its login page.'),
  }));
});

/**
 * Assert that the account of this browser may not open an admin page: the admin sends it to the dashboard
 * with "Sorry, you do not have permission to access this area.", a visitor to the login page, or it answers
 * 403. An address of the admin is a path under the admin ("/admin/users/").
 *
 * Example #1: Then I should not be allowed to open "/admin/users/"
 * Example #2: Then we should not be allowed to open "/admin/groups/"
 * Example #3: And I should not be allowed to open "/admin/redirects/"
 * Example #4: Then I should not be allowed to open "/admin/sites/"
 * Example #5: Then I should not be allowed to open "/admin/workflows/list/"
 */
Then(/^(I |we )*should not be allowed to open "([^"]*)"$/, async function (pronounCase, path) {
  const wanted = h.absolute(this, path);
  const response = await h.open(this, wanted);
  const status = response ? response.status() : 0;
  const here = h.pathOf(this, this.page.url());
  const refusal = (await h.messages(this.page, 'error')).find((m) => /permission/i.test(m));
  const toLogin = (await h.loginForm(this.page).username.count()) > 0;
  if (status === 403 || toLogin || (refusal && here !== h.pathOf(this, wanted))) return;
  throw friendly({
    message: `${path} opened for this account: ${await h.pageSummary(this)} (answer ${status}).`,
    hint: 'The admin refuses an area an account has no permission for by sending it to the dashboard with "Sorry, you do not have permission to access this area.".',
  });
});

/**
 * Ask for a password reset as a person does: "Forgotten password?" on the login page, the email address of an
 * account of the users registry (or an address), "Reset password". The site answers every address alike ("A
 * link to reset your password has been emailed to you if an account exists for this address.").
 *
 * Example #1: When I ask for a password reset link for "editor"
 * Example #2: When we ask for a password reset link for "moderator"
 * Example #3: And I ask for a password reset link for "nobody@example.com"
 * Example #4: When I ask for a password reset link for "administrator"
 * Example #5: When I ask for a password reset link for "editor@example.com"
 */
When(/^(I |we )*ask for a password reset link for "([^"]*)"$/, { timeout: 90000 }, async function (pronounCase, who) {
  const page = this.page;
  const address = h.addressOf(this, who);
  await page.context().clearCookies();
  await h.open(this, h.adminUrl(this, 'login/'));
  const link = page.getByRole('link', { name: /Forgotten password/i });
  if (!(await link.count())) throw friendly({ message: `The login page has no "Forgotten password?" link: ${await h.pageSummary(this)}.`, hint: 'The admin offers the password reset when WAGTAIL_PASSWORD_RESET_ENABLED is on (the default).' });
  await h.afterNavigation(this, () => link.first().click());
  const field = page.locator('main input[type="email"], main input[name="email"]').first();
  await field.fill(address);
  await h.afterNavigation(this, () => page.locator('main').getByRole('button', { name: /Reset password/i }).first().click());
  await h.eventually(this, async () => h.clean(await page.locator('main').innerText().catch(() => '')), (t) => /emailed|check your email/i.test(t), async (t) => ({
    message: `The site did not confirm the reset request: "${t.slice(0, 200)}".`,
    hint: 'The page after the request says "Check your email".',
  }));
});

/**
 * On the page a reset link opens ("Set your new password"), set the password of an account of the users registry
 * as its new password, as a person does: "New password", "New password confirmation", "Reset password". The
 * account keeps the password the registry knows, so the suite can go on logging in with it; no password is
 * written in the feature.
 *
 * Example #1: When I set the password of "editor" on the reset page
 * Example #2: When we set the password of "moderator" on the reset page
 * Example #3: And I set the password of "editor" on the reset page
 * Example #4: When I set the password of "administrator" on the reset page
 * Example #5: When we set the password of "editor" on the reset page
 */
When(/^(?:I|we) set the password of "([^"]*)" on the reset page$/, { timeout: 90000 }, async function (handle) {
  const page = this.page;
  const user = h.resolveUser(this, handle);
  const main = page.locator('main');
  const first = await h.findField(this, 'New password', main);
  const second = await h.findField(this, 'New password confirmation', main);
  if (!first || !second) {
    throw friendly({ message: `The page is not the page of a reset link: ${await h.pageSummary(this)}.`, hint: 'Open the link of the reset mail first: When I open the "/password_reset/" link of the email with the subject "Password reset" to "…"' });
  }
  await first.fill(user.password);
  await second.fill(user.password);
  await h.afterNavigation(this, () => main.getByRole('button', { name: /Reset password/i }).first().click());
  const errors = (await h.fieldErrors(page)).map((e) => (e.label ? `${e.label}: ` : '') + e.text);
  if (errors.length) throw friendly({ message: `The new password was refused: ${h.listed(errors)}.`, hint: 'A reset link works once; the site\'s password rules apply to the new password.' });
});
