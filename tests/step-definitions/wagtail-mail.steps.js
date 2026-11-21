'use strict';

// The mail the site sends (a password reset, the notices of a workflow: a page submitted, approved, sent back
// with a comment; a form's submission), read from the mail catcher of the site (worldParameters.mailUrl, a
// Mailpit): a mail that came to an account, what it says, and its links. A step reads the mail that came since
// the scenario started: never a mail of an earlier scenario or run.

const { Before, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./wagtail-helpers');

Before(function () {
  this.__scenarioStartedAt = Date.now();
});

/** The moment from which a mail step reads the mailbox (a second earlier: the clocks of the site and the machine). */
function mailSince(world) {
  return (world.__scenarioStartedAt || 0) - 1000;
}

/** The newest mail to an address with a subject (a part of it) since the scenario began, waiting for it to come. */
async function waitForMail(world, address, subject) {
  let seen = [];
  return h.eventually(world, async () => {
    const all = await h.mailTo(world, address);
    seen = all.filter((m) => Date.parse(m.Created) >= mailSince(world));
    return seen.find((m) => h.mentions(m.Subject, subject)) || null;
  }, (m) => !!m, () => ({
    message: `No mail "${subject}" came to ${address} in this scenario${seen.length ? `; it got ${h.listed(seen.map((m) => m.Subject))}` : ''}.`,
    hint: `The site sends its mail to the mail catcher (${h.mailUrl(world)}); check its email settings (the SMTP host and port), and that the account wants the notice (its notification settings).`,
  }), h.budget(world));
}

/**
 * A mail with a subject (a part of it is enough) came to an account of the users registry (its email) or to an
 * address, since the scenario began.
 *
 * Example #1: Then an email with the subject "Password reset" should be sent to "editor"
 * Example #2: Then an email with the subject "has been submitted for approval" should be sent to "moderator"
 * Example #3: And an email with the subject "has been rejected" should be sent to "editor"
 * Example #4: Then an email with the subject "has been approved" should be sent to "editor"
 * Example #5: Then an email with the subject "Contact message" should be sent to "us@example.com"
 */
Then(/^an email with the subject "([^"]*)" should be sent to "([^"]*)"$/, async function (subject, who) {
  await waitForMail(this, h.addressOf(this, who), subject);
});

/**
 * No mail came to an address since the scenario began (the site answers a password reset for an unknown
 * address as for a known one, and sends nothing). The step waits a moment for a mail that is late.
 *
 * Example #1: Then no email should be sent to "nobody@example.com"
 * Example #2: Then no email should be sent to "member"
 * Example #3: And no email should be sent to "nobody@example.com"
 * Example #4: Then no email should be sent to "someone-else@example.org"
 * Example #5: But no email should be sent to "nobody@example.com"
 */
Then(/^no email should be sent to "([^"]*)"$/, async function (who) {
  const address = h.addressOf(this, who);
  const deadline = Date.now() + 3000;
  for (;;) {
    const came = (await h.mailTo(this, address)).filter((m) => Date.parse(m.Created) >= mailSince(this));
    if (came.length) throw friendly({ message: `A mail came to ${address}: ${h.listed(came.map((m) => m.Subject))}.`, hint: 'Look at the mail catcher: the site sent a mail where none was expected.' });
    if (Date.now() > deadline) return;
    await this.page.waitForTimeout(250);
  }
});

/**
 * The mail with a subject to an account or an address says a text (in its plain text or its HTML).
 *
 * Example #1: Then the email with the subject "has been rejected" to "editor" should contain "Please add a photo."
 * Example #2: Then the email with the subject "Password reset" to "editor" should contain "Your username (in case you've forgotten): editor"
 * Example #3: And the email with the subject "has been approved" to "editor" should contain "Looks good."
 * Example #4: Then the email with the subject "has been submitted for approval" to "moderator" should contain "Webship test page"
 * Example #5: Then the email with the subject "Contact message" to "us@example.com" should contain "Webship test message"
 */
Then(/^the email with the subject "([^"]*)" to "([^"]*)" should contain "([^"]*)"$/, async function (subject, who, expected) {
  const address = h.addressOf(this, who);
  const found = await waitForMail(this, address, subject);
  const message = await h.mailMessage(this, found.ID);
  const text = h.mailText(message);
  if (!h.mentions(text, expected)) throw friendly({ message: `The mail "${message.Subject}" to ${address} does not say "${expected}". It says: "${text.slice(0, 400)}".`, hint: 'The words of the mail are the site\'s templates.' });
});

/**
 * Open in the browser the link of the newest mail with a subject to an account or an address, since the
 * scenario began: its first link to the site, or the one that holds a part of an address ("/password_reset/",
 * "/edit/").
 *
 * Example #1: When I open the link of the email with the subject "Password reset" to "editor"
 * Example #2: When I open the "/edit/" link of the email with the subject "has been rejected" to "editor"
 * Example #3: And we open the link of the email with the subject "Password reset" to "moderator"
 * Example #4: When I open the "/password_reset/" link of the email with the subject "Password reset" to "editor"
 * Example #5: When we open the "/edit/" link of the email with the subject "has been approved" to "editor"
 */
When(/^(?:I|we) open the (?:"([^"]*)" )?link of the email with the subject "([^"]*)" to "([^"]*)"$/, async function (part, subject, who) {
  const address = h.addressOf(this, who);
  const found = await waitForMail(this, address, subject);
  const links = h.mailLinks(await h.mailMessage(this, found.ID));
  const site = new URL(h.siteRoot(this)).host;
  const ofSite = links.filter((l) => { try { return new URL(l.href).host === site; } catch (e) { return false; } });
  const link = part ? ofSite.find((l) => l.href.includes(part)) : ofSite[0];
  if (!link) throw friendly({ message: `The mail "${found.Subject}" to ${address} has no link${part ? ` with "${part}"` : ''} to the site. Its links: ${h.listed(links.map((l) => l.href))}.`, hint: 'The site writes its links with its own address (WAGTAILADMIN_BASE_URL): check it matches launchUrl.' });
  await h.open(this, link.href);
});

module.exports = { waitForMail, mailSince };
