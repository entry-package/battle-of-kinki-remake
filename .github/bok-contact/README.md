# Bok contact form

The public form at `/contact.html` sends an administrator notification to
`info@package-inc.com` and a receipt to the visitor's email address. Both emails
must have `info@package-inc.com` as their From address. The dedicated
Google Apps Script receiver runs as its deployment owner with only the
`script.send_mail` OAuth scope. It does not read Gmail, Drive, or Sheets.

## Deployment

Use the Google account `info@package-inc.com` to create and deploy the dedicated
Bok Apps Script project. MailApp sends from the deployment owner's account; its
`name` and `replyTo` options do not change the From address. A project deployed
under another account does not meet this requirement.

Copy `backend/Code.gs` and `backend/appsscript.json` into that project. Publish a
web-app version that executes as the deployment owner
and permits anonymous access, then set `data-endpoint` in `contact.html` to that
version's `/exec` URL. The form intentionally refuses to submit until a valid
deployment URL is configured. Do not deploy the website before that step.

The receiver accepts only the two production Bok page origins. Local browser
checks do not constitute an end-to-end email test. After publication, submit an
explicitly marked test from the production form and independently verify both
the notification in `info@package-inc.com` and the sender receipt. Inspect the
actual From header on both messages and confirm `info@package-inc.com`.

## Behavior and limits

- The form waits for a trusted Apps Script response with the matching request ID;
  an iframe load alone is never reported as success.
- Timeouts reuse the same captured submission and request ID. Cache entries
  prevent duplicate sends for up to six hours while retained by Apps Script.
- Input limits, a honeypot, per-sender throttling and a daily maximum of 100
  submissions limit abuse. The Google account's mail quota also applies.
- Email-send exceptions are reported as uncertain; a receipt failure does not
  cause the administrator notification to be resent.
- The server response and logs omit submitted personal fields. Request IDs and
  a sender email hash are cached temporarily; only the daily count is stored in
  script properties. Inquiry content is retained in the recipients' mailboxes.
- The source manifest and receiver must be deployed together. Updating an Apps
  Script editor file alone does not update an existing published version.

## Local checks

Run from the repository root:

```sh
node .github/bok-contact/test-backend.cjs
node .github/bok-contact/test-contact.cjs
node --check contact.js
node --check < .github/bok-contact/backend/Code.gs
git diff --check
```

These tests use mocked mail/network transports and never send real email.
