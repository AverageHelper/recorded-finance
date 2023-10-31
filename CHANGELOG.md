# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Changed
- Removed `uuid`, `safe-compare`, and `tsscmp` dependencies in favor of Node-native and browser-native alternatives.
- Removed `jest-extended` in favor of native Vitest assertions.

## [0.18.8] - 2023-10-30
### Changed
- Replaced Jest with Vitest.

### Fixed
- Added Token field to "Change Password" form. Previously, the password change process would simply error out early, but still update the DEK. This leaves the account in a very weird state where the old password is required to enter the and download data, but the data may only be decrypted using the new password! Maybe one day I'll add a separate modal view to collect that password, to aid in getting out of this state, but for now, provide your TOTP token. And don't get it wrong, or bad things might happen! :D

## [0.18.7] - 2023-10-22
### Fixed
- List items now properly take `Spacebar` and `Enter` keys as navigation directives, instead of taking _every_ key.

## [0.18.6] - 2023-10-21
### Fixed
- The "Recent Locations" dropdown no longer just turns invisible while "closed". Mouse events should now work properly beneath the location selector while it's closed.

## [0.18.5] - 2023-08-12
### Changed
- Updated back-end engine to Node 18

## [0.18.4] - 2023-08-07
### Added
- Comprehensive unit test line coverage of REST endpoints.

### Fixed
- Clarified and documented API responses for when the user is out of storage, and when our server isn't accepting new users.
- Respond HTTP 200, instead of 404, when deleting any unknown collection. If the collection doesn't exist, it must already be gone!
- Respond HTTP 400, instead of 404, when trying to write data to an unknown collection. If later we add new collection IDs, a 400 still makes more sense than a 404. If later we permit arbitrary IDs, a 404 won't make any sense at all.

### Security
- Respond with appropriate security headers

## [0.18.3] - 2023-05-22
### Fixed
- Our Express environment now sends the `Access-Control-Allow-Headers` header with each request, as our Vercel environment does.
- Our Express environment no longer sends HTTP 404 when making a request to a valid endpoint using the wrong method. We now, correctly, send HTTP 405, as our Vercel environment does.

### Security
- `DELETE /v0/totp/secret` now sends HTTP 403 when the password is incorrect, even when the user does not have TOTP enabled. Before, this endpoint would ignore the password field and send HTTP 200 if the user does not have TOTP enabled. This wasn't _much_ of a security issue, since that endpoint and method requires a valid session anyway, but since a password is a required field to do a delete, it makes sense to not respond HTTP 200 unless the password is correct.

## [0.18.2] - 2023-07-30
### Security
- Updated vulnerable dependencies

## [0.18.1] - 2023-03-24
### Added
- A management UI for viewing database contents. (These should be encrypted client-side, so there's no user data to see here. I just don't wanna have to write a query string every time I need to read other parts of the database.)

### Changed
- Moved our front-end cryption logic somewhere more self-contained, to help with potential future optimizations.

## [0.18.0] - 2023-03-11
### Added
- [Open Graph](https://ogp.me) tags for social media embeds.
- Autofocus the title field in the Create Transaction screen.

### Removed
- Removed geolocation look-up logic (IPLocate calls, etc.) for now, trying to simplify things. Will re-evaluate how or if to do geolocation stuff later on.

### Fixed
- Text fields no longer steal focus from one another (especially in the Create Transaction screen).
- The location dropdown is no longer utterly broken.

## [0.17.0] - 2023-03-03
### Added
- Loading spinners for Account and Transaction lists.

### Changed
- Greatly simplified transaction storage logic, and found a much more efficient way to count balances. Load times should be considerably faster!

### Fixed
- The account balance no longer runs around like a slot machine while loading transactions.
- Months now sort correctly when switching between account views.
- Fixed data watchers not responding for users with 2FA enabled.

## [0.16.8] - 2023-03-01
### Changed
- More robust HTTP status codes on the back-end.

### Fixed
- Duplicate logging of allowed origin hostnames (back-end).

## [0.16.7] - 2023-02-19
### Changed
- Better optimized database snapshots on the front-end, with thorough unit testing around relevant structures.

## [0.16.6] - 2023-02-18
### Fixed
- The app no longer redundantly recalculates caches on transaction documents that were unchanged for a given write. This means the transaction list reloads much faster for long transaction history when you make a change, like marking a transaction as "resolved".

### Security
- Updated vulnerable dependencies.

## [0.16.5] - 2023-02-17
### Added
- The app now displays a big scary warning message in the devtools console. Nobody should be pasting stuff in there that strangers tell them to paste in, so we make that clear.

### Fixed
- The height of the language selector should now be reasonable on Chromium-based browsers.

## [0.16.4] - 2023-02-17
### Changed
- Reorganized some internal en/decryption structures in preparation for better asynchronous handling.

## [0.16.3] - 2023-01-29
### Changed
- Ok, we'll release with every push for now, until we figure out a consistent way to parse the changelog for this.

## [0.16.2] - 2023-01-29
### Added
- [security.txt](https://recorded.finance/.well-known/security.txt) file based on the spec described in [securitytxt.org](https://securitytxt.org).

### Changed
- Our pipeline now only deploys to production if we've cut a new semver version.

### Removed
- Got rid of our default Vue favicon.

## [0.16.1] - 2023-01-16
### Added
- Improved experience for users who have JavaScript disabled.
  - If the front-end loads with JavaScript disabled (whether at the browser level, or by an extension such as [NoScript](https://noscript.net)), then the Home page will now appear, and will be very similar in appearance to the way it would render normally in the en-US locale.
  - This page is hard-coded. It is removed and replaced when JavaScript loads.
  - Because the page is not dynamically generated, we can only render the Home page, regardless of the URL path at load time. Here is room for future improvement!
  - Because our locale detection relies on JavaScript, this webpage is _only rendered in English_.
  - Because our in-app navigation routing relies on JavaScript, internal navigation routes are disabled, and replaced in some areas with hints to enable JavaScript.
  - This feature helps us have a contentful load much more quickly, and helps out search-engine indexers who don't wanna run potentially-unsafe JavaScript.

## [0.16.0] - 2023-01-15
### Changed
- Dropped support for Safari 13, [because Vite](https://vitejs.dev/guide/build.html#browser-compatibility).
- Enhanced keyboard support in custom controls.

## [0.15.3] - 2023-01-14
### Changed
- Renamed from 'Accountable' to 'Recorded Finance'. Hopefully we don't have to rename ourselves again soon!
- Improved a11y scores on [webpagetest.org](https://www.webpagetest.org/).

### Security
- Updated vulnerable dependencies.

## [0.15.2] - 2022-12-21
### Changed
- Bundle Bootstrap CSS directly, avoid fetching from a CDN.

### Security
- Updated vulnerable back-end dependencies.

## [0.15.1] - 2022-12-20
### Added
- More translations. (Many were added in 0.15.0)

## [0.15.0] - 2022-12-20
### Changed
- Prettier styles, using Bootstrap for most things.

### Fixed
- Fixed incorrect OpenAPI spec for downloading attachment data.

## [0.14.6] - 2022-11-20
### Fixed
- Attachments not loading, something about "Invalid file data"

## [0.14.5] - 2022-11-20
### Changed
- The back-end no longer logs query params in the clear. Instead, the params are described vaguely so as to aid only debugging.

## [0.14.4] - 2022-11-15
### Added
- Autofocus the TOTP field.
- Autosubmit the TOTP on paste.

## [0.14.3] - 2022-11-11
### Changed
- Improved our back-end logging to make transport and formatting middleware easy to install and change.

## [0.14.2] - 2022-11-09
### Changed
- We now generate client-side API interfaces from the server's [OpenAPI spec](/server/openapi.yaml). This means better static assurances that we're doing stuff correctly on the front-end. (Still gotta keep the spec up with the back-end logic tho).
- Clearer OpenAPI spec with regard to batch writes.

### Security
- The client now attempts to establish WebSocket connections over SSL. TIL that isn't the default for the `ws` protocol.

## [0.14.1] - 2022-11-09
### Added
- All API endpoints now support being run as Vercel serverless functions.
- When running under Vercel, the server cannot handle WebSocket requests directly. Clients must use the `PubNub` client to subscribe to event channels.
- Server administrators who wish to host on Vercel should set up a PubNub account, as described in the server's [README](/server/README.md#prerequesites).

### Fixed
- Fixed an issue where requesting deletion of the user's personal preference documents would inadvertently erase every user's data.

### Security
- Fixed an issue where requesting the user's personal preferences would instead send the user's access control hashes (password hash, password salt, MFA seeds, etc.) This information is largely useless to the end user, including the MFA seeds which require information only the server knows, but still spoopy to send to clients.

## [0.14.0] - 2022-10-02
### Changed
- The server's `DB` environment variable is now ignored. All persistent data now lives on the database identified by the value of the server's `DATABASE_URL` environment variable. [See the README](/server/README.md) for details.
- Reorganized API implementations for better parity between [SvelteKit](https://kit.svelte.dev/docs/routing#server) and Express server.
- Moved JWT early-expiration to the database. Logout operations should now be safe between server restarts.

### Removed
- The database migration logic from [0.13.0](#0130---2022-10-01) has been removed. Your old data now lives on a MySQL server of your choosing.

## [0.13.2] - 2022-10-02
### Fixed
- Migration would throw for users with no attachments. That's fixed now.

## [0.13.1] - 2022-10-01
### Fixed
- Migration is more reliable now.

## [0.13.0] - 2022-10-01
### Added
- Migration logic for moving from lowdb to MySQL. The move \*should\* happen automatically at startup. You may need to run the appropriate Prisma CLI command(s) to deploy the new schema to your database before startup. I'm sorry if you've relied on our local JSON file storage, or really want to stick with that, but it was always silly, and I should have done something like this months ago.
  - lowdb-to-MySQL migration logic and related dependencies will be removed in the next **SemVer Minor** release.
  - Why not wait until SemVer Major? Because we're still in 0.x.x, and you really should expect breaking changes at this phase anyway. 🤙
  - There is a "dry run" mode, enabled by default, which will run the upload under known limitations and identify documents which would not fit the new database. To enable the actual data migration, go to `/server/database/io.ts` and change the value of the `MIGRATION_DRY_RUN` constant to `false`.

### Changed
- BREAKING: We now use MySQL as our database. Accountable's hosted solution will (probably) use [PlanetScale](https://planetscale.com/), but feel free to point your own Accountable instance at whatever database server you want.
- BREAKING: The server now requires the `DATABASE_URL` environment variable to be set. See the [README](/server/README.md) for details.
- Attachments are no longer stored as local files. These are now limited to 4.2 MB, and stored in the database with everything else. The abstraction is arranged such that other storage adapters may be emplaced, but for now, this should suffice for most encrypted files the size of receipt images.

### Removed
- All local filesystem write APIs. Once the old database is abandoned, you may keep the legacy files as a backup, or destroy them.

## [0.12.0] - 2022-09-24
### Added
- Server endpoints to support TOTP 2FA. See our [API documentation](https://petstore.swagger.io/?url=https://raw.githubusercontent.com/RecordedFinance/recorded-finance/HEAD/server/openapi.yaml) for details.

### Changed
- BREAKING: The server now requires the `AUTH_SECRET` environment variable to be set. This value should be randomly generated (perhaps using a [password generator](https://bitwarden.com/password-generator/)) and kept safe. This value lets the server sign JWTs and generate user secrets. See the [README](/server/README.md) for info.
- The client now accepts "extra" values from server responses. This way, old clients can still talk to new server instances without much issue.

### Fixed
- The server now accepts user session tokens across reboots! Go ahead and restart your server all you want, clients should now take the change in stride!
- The server no longer sends the user's password hash in their JWT. That was silly to do. Not sure why we did that. We don't do that anymore.

## [0.11.3] - 2022-09-09
### Security
- Removed `git-diff`. They're vulnerable to shell injection. I've seen this myself in another project, and [has been observed by others](https://github.com/danday74/git-diff/issues/6).

## [0.11.2] - 2022-09-09
### Added
- Automated our release process and changelog handling. This changelog entry is a test that I only need to add an entry here for a release to be automatically deployed. The [Releases](https://github.com/RecordedFinance/recorded-finance/releases) view should automatically see this entry.

### Changed
- Updated some CI/CD analysis tools.

## [0.11.1] - 2022-09-07
### Security
- Addressed [CWE-20](https://cwe.mitre.org/data/definitions/20.html): The client now checks that the origin incoming server messages through the WebSocket channel match the expected origin.

## [0.11.0] - 2022-09-01
### Changed
- BREAKING: The server now requires the `DB` environment variable to be set.
- BREAKING: Improved the ergonomics of WebSocket communications. This means the client and server are no longer compatible.
- Improved front-end JavaScript fallback. Plugins that block JavaScript per-site don't always let the browser fall back to the `noscript` tag, so now we instead insert a tag that disappears when JavaScript loads.
- Back-end code now gets bundled into an almost-self-contained JS file. A few dependencies still need to stay in node_modules for the time being, but I expect that to change soon. This new bundle should mean faster initial load times, but I haven't tested that, and I don't care. I just think Rollup is neat.
- The server now uses [Superstruct](https://github.com/ianstormtaylor/superstruct) (instead of Joi) for message validation. This helps to keep our front-end and back-end paradigms consistent, and keeps our subdependencies down (since Superstruct has none). But mostly, I did this because Superstruct plays better with Rollup than Joi does. :P

## [0.10.2] - 2022-08-13
### Added
- UI to manually select a preferred language.
- Some Brazilian Portuguese translations.
- New info in [CONTRIBUTING.md](CONTRIBUTING.md) about how to contribute translations.

### Changed
- Shrunk the deployable bundle by removing unused dependencies and properly tree-shaking the remaining dependencies.
- More user-facing strings refactored into i18n keys. I think I found all of the user-facing strings reasonably enough now, though testing and experience will tell for sure if I missed anything.
- The hamburger menu closes when the user selects a language.
- Improved the cookie disclaimer.

### Fixed
- Fixed the "Add a Transaction" button adding erroneously to the navigation stack, which incorrectly required the user to press Back more times the more transactions they created in order to return to the Accounts list.

## [0.10.1] - 2022-08-05
### Fixed
- Fixed annoying flashing text when entering the login screen.

## [0.10.0] - 2022-08-05
### Changed
- Ported front-end code from Vue to Svelte. It's [pretty cool](https://svelte.dev/).
  - I want to experiment with Accountable under different front-end paradigms. So far, I've used [Flutter](https://github.com/AverageHelper/accountable-flutter), [Vue](https://github.com/AverageHelper/accountable-vue), and now [Svelte](https://github.com/RecordedFinance/recorded-finance). This version is the Svelte port.
  - Svelte differs from Vue in that Svelte is a compiler, not a runtime. The bundled output contains only code needed for each component to work. There's no virtual DOM, but there's also no helpful front-end safety net.
  - Eventually, I plan to separate the back-end code from the front-end, so I'm not duplicating that part across several front-end repositories.

## [0.9.1] - 2022-07-12
### Fixed
- Don't delete EVERY ATTACHMENT FILE when deleting unrelated documents.

## [0.9.0] - 2022-07-12
### Changed
- Large file storage is now handled in the same set of API endpoints as database storage, to simplify documentation.
- Large files are ingested first to a system-determined temporary directory, then moved into their permanent spot on the filesystem.
- Use [`multer`](https://www.npmjs.com/package/multer) instead of [`busboy`](https://www.npmjs.com/package/connect-busboy) for processing files.

### Security
- Updated [`nodemon`](https://www.npmjs.com/package/nodemon), which removed a lot of useless dependencies and solved a test-time vulnerability.

## [0.8.1] - 2022-07-02
### Added
- **Client:** We now show what the account's balance was at each transaction.
- **Client:** Transactions now show their `isReconciled` status on their detail page.

### Changed
- **Client:** Some smol code helps to make certain things easier to implement
- **Server:** Disabled throttling on the `GET /session` endpoint. It was getting annoying having to restart the server every other time I refreshed the page. I'll re-enable throttling there after some rethinking.

### Fixed
- **Client:** We now properly clear the location and transaction caches on lock/logout
- **Client:** We now sort months more consistently in reverse-chronological order. For real this time. (Probably.)

## [0.8.0] - 2022-07-02
### Added
- **Server:** Log the current server version on startup
- **Server:** Added support for our new `cryption` document attribute (#45)

### Changed
- **Client:** Refactored our local data model definitions from `class` declarations to `interface` definitions and pure functions.
- **Client:** Did some research on [how crypto-js handles its key size config](https://cryptojs.gitbook.io/docs/#pbkdf2), discovered the likely reason why my PBKDF call takes so much time: It turns out that `keySize` is in _words_, not _bytes_. I think my keys are 8,192 bits long. I'm sorry.
- **Client:** Reorganized cryption stuff to make migration easier
- **Server:** Log the result of each CORS check
- **Server:** Removed some useless dependencies (#44)

### Fixed
- **Server:** Send cookies with request responses

## [0.7.0] - 2022-06-30
### Added
- **Client:** Introduced a "Lock" mechanism. Since we now keep the login token in the browser with a cookie, rather than in JavaScript that we control manually, the app can keep its login state between refreshes. However, the user's password—which is used for decryption—isn't kept in any persistent way, so we must ask the user again for that information. The "Locked" screen will appear when we have an auth token, but still need the user password to read the user's data.
- **Client:** Start internationalizing our user-facing strings
- **Client:** Added a button to clear the search query

### Changed
- **Client:** We shouldn't keep the login token anywhere that JavaScript can get to it. The client no longer sends a token directly via the API, but instead returns its cookies via standard HTTP semantics. We assume that auth state is handled in an [`HttpOnly`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#security) cookie, so we don't try to receive or send a JWT when interacting with the server.
- **Server:** The server still accepts `Authentication` tokens, but now also accepts a cookie. The server now sets an [`HttpOnly`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#security) cookie with the login token so that the web client doesn't have to handle the auth token itself.

### Security
- **Server:** Fixed a path traversal exploit in the file storage endpoint. (Thanks to [Snyk](https://snyk.io/) for pointing that out to me!)

## [0.6.4] - 2022-06-08
### Added
- Added a way for folks to support this project
- **Server:** Send consistent error codes to provide more context to error responses

### Changed
- **Client:** Use error codes instead of the server's default error message, to make eventual internationalization easier

## [0.6.3] - 2022-06-07
### Changed
- Minor internal changes to make future maintenance easier

### Fixed
- **Server:** We now validate incoming JWT payload structures (using Joi)

## [0.6.2] - 2022-06-03
### Added
- **Client:** Add an env variable to toggle signup UI

### Fixed
- **Server:** The `/join` endpoint now respects the internal `MAX_USERS` variable to prevent new signups if we've exceeded the limit

## [0.6.1] - 2022-05-28
### Changed
- **BREAKING:** All API routes now have a `/v0` prefix to them. Old routes will not work. I won't bother with redirects, since we've not even hit a proper 1.0 build yet.
- **Client:** Don't hard-code route paths. That was always gross. Why did I do that?

### Fixed
- **Client:** Months weren't sorted properly

## [0.6.0] - 2022-05-28
### Changed
- **Client:** Group transactions by month in the Account view. This should mean less rendering time for long transaction lists.

## [0.5.7] - 2022-05-13
### Changed
- **Client:** Use the browser's native date/time picker, now that there's a widely-accepted native one. Still need to handle time zones somehow, but at least this input knows that 1 May 2022 is a _Sunday_ and not a _Tuesday_ lol

## [0.5.6] - 2022-04-04
### Changed
- **Client:** Use 24-hr time. It is superior.

### Security
- Fixed a vulnerable dependency.

## [0.5.5] - 2022-03-14
### Changed
- **Client:** Improved layout for the tag picker

## [0.5.4] - 2022-03-12
### Changed
- **Client:** Move major page components out of the generic `components` directory
- **Server:** Move error definitions to a special `errors` directory
- **Server:** Prevent users from uploading larger attachments than their storage space allotment

## [0.5.3] - 2022-02-25
### Added
- **Client:** Click an existing tag to add it to the transaction

### Fixed
- **Client:** Fixed a bug that caused an account's total to double when the user opened the account view

## [0.5.2] - 2022-02-21
### Fixed
- Fixed a bug where the Accounts list would fail to prefetch transactions in all accounts but one (if the user had more than one account)
- Probably fixed a bug that prevented watchers from restarting themselves in the event of failure

## [0.5.1] - 2022-02-19
### Added
- **Client:** The tab bar now joins the side menu on small screens

### Fixed
- **Client:** Fixed weirdness when entering a negative amount into `CurrencyInput`
- Known issues:
  - Light mode doesn't exist anymore. I'll turn it back on when I've had time to design it better
  - The accounts list disappears with an error, something to do with server connection. I'm not sure why this happens, or why the Reload button doesn't work.

## [0.5.0] - 2022-02-18
### Added
- **Server:** Add a basic `ping` REST endpoint
- **Server:** Add a basic `version` REST endpoint
- **Server:** Inform clients of their disk usage after every write
- **Server:** Keep track of how much space users use, and don't let them exceed their limit
- **Server:** Establish a "Ping" protocol for our websocket
  - Automatically tear down websocket if the client stops responding for a while
- **Client:** Show the current server version in the footer
- **Client:** Respond to the server's websocket pings so the server knows whether we've died
- **Client:** Make disk usage information available in the corner menu

### Changed
- **Server:** Re-enable request throttling by IP address
- **Client:** Better frontend reporting of websocket errors

## [0.4.3] - 2022-02-16
### Added
- Add a URL path to get to the signup form directly

### Changed
- Rename "password" to "passphrase" externally

## [0.4.2] - 2022-02-16
### Added
- Use new file uploads to reattach broken attachments
- Better search UI for transactions

## [0.4.1] - 2022-02-15
### Added
- Accountable can now handle importing zip files in excess of 5 GB. Not sure what the upper limit is.
- Attachment import is still quite broken for imports that massive; something takes too much memory to get it done. Not sure if that's on the client or the server. Needs more investigation.

## [0.4.0] - 2022-02-01
### Added
- Implement proper batched writes
  - I _should_ handle data races properly, but this was a lot more fun! (Also it's just me who uses the app at a time, so this lets me put off MongoDB for a while longer.)

### Changed
- [BREAKING] Some fixes to the way account creation happens. No more extra data dirtying up the user's preferences and confusing the client.

## [0.3.4] - 2022-01-31
### Changed
- Just some re-working to make our vendor bundle fit within the recommended 500 KiB:
  - Replace [Joi](https://github.com/sideway/joi) with [Superstruct](https://www.npmjs.com/package/superstruct) on the client
  - Tree-shake away Bootstrap's JavaScript bundle. Use Vue's own state mechanics instead.

## [0.3.3] - 2022-01-31
### Added
- Implement account deletion

### Fixed
- Fix CSS bugs around the signup flow

## [0.3.2] - 2022-01-31
### Fixed
- Filter transactions properly by account
- Make file uploads work again

## [0.3.1] - 2022-01-26
### Added
- Added a proper homepage.

## [0.3.0] - 2022-01-18
### Changed
- Move to our own server code. This is a breaking change (since we don't have any way of migrating from Firebase at the moment).

## [0.2.0] - 2021-11-30
### Fixed
- Data exports don't need to duplicate location, tag, and attachment metadata. Fixed that.

## [0.1.0] - 2021-11-28
### Added
- Initial prerelease

## [0.0.0] - 2021-10-01
### Added
- Initial commit

[Unreleased]: https://github.com/RecordedFinance/recorded-finance/compare/v0.18.8...HEAD
[0.18.8]: https://github.com/RecordedFinance/recorded-finance/compare/v0.18.7...v0.18.8
[0.18.7]: https://github.com/RecordedFinance/recorded-finance/compare/v0.18.6...v0.18.7
[0.18.6]: https://github.com/RecordedFinance/recorded-finance/compare/v0.18.5...v0.18.6
[0.18.5]: https://github.com/RecordedFinance/recorded-finance/compare/v0.18.4...v0.18.5
[0.18.4]: https://github.com/RecordedFinance/recorded-finance/compare/v0.18.3...v0.18.4
[0.18.3]: https://github.com/RecordedFinance/recorded-finance/compare/v0.18.2...v0.18.3
[0.18.2]: https://github.com/RecordedFinance/recorded-finance/compare/v0.18.1...v0.18.2
[0.18.1]: https://github.com/RecordedFinance/recorded-finance/compare/v0.18.0...v0.18.1
[0.18.0]: https://github.com/RecordedFinance/recorded-finance/compare/v0.17.0...v0.18.0
[0.17.0]: https://github.com/RecordedFinance/recorded-finance/compare/v0.16.8...v0.17.0
[0.16.8]: https://github.com/RecordedFinance/recorded-finance/compare/v0.16.7...v0.16.8
[0.16.7]: https://github.com/RecordedFinance/recorded-finance/compare/v0.16.6...v0.16.7
[0.16.6]: https://github.com/RecordedFinance/recorded-finance/compare/v0.16.5...v0.16.6
[0.16.5]: https://github.com/RecordedFinance/recorded-finance/compare/v0.16.4...v0.16.5
[0.16.4]: https://github.com/RecordedFinance/recorded-finance/compare/v0.16.3...v0.16.4
[0.16.3]: https://github.com/RecordedFinance/recorded-finance/compare/v0.16.2...v0.16.3
[0.16.2]: https://github.com/RecordedFinance/recorded-finance/compare/v0.16.1...v0.16.2
[0.16.1]: https://github.com/RecordedFinance/recorded-finance/compare/v0.16.0...v0.16.1
[0.16.0]: https://github.com/RecordedFinance/recorded-finance/compare/v0.15.3...v0.16.0
[0.15.3]: https://github.com/RecordedFinance/recorded-finance/compare/v0.15.2...v0.15.3
[0.15.2]: https://github.com/RecordedFinance/recorded-finance/compare/v0.15.1...v0.15.2
[0.15.1]: https://github.com/RecordedFinance/recorded-finance/compare/v0.15.0...v0.15.1
[0.15.0]: https://github.com/RecordedFinance/recorded-finance/compare/v0.14.6...v0.15.0
[0.14.6]: https://github.com/RecordedFinance/recorded-finance/compare/v0.14.5...v0.14.6
[0.14.5]: https://github.com/RecordedFinance/recorded-finance/compare/v0.14.4...v0.14.5
[0.14.4]: https://github.com/RecordedFinance/recorded-finance/compare/v0.14.3...v0.14.4
[0.14.3]: https://github.com/RecordedFinance/recorded-finance/compare/v0.14.2...v0.14.3
[0.14.2]: https://github.com/RecordedFinance/recorded-finance/compare/v0.14.1...v0.14.2
[0.14.1]: https://github.com/RecordedFinance/recorded-finance/compare/v0.14.0...v0.14.1
[0.14.0]: https://github.com/RecordedFinance/recorded-finance/compare/v0.13.2...v0.14.0
[0.13.2]: https://github.com/RecordedFinance/recorded-finance/compare/v0.13.1...v0.13.2
[0.13.1]: https://github.com/RecordedFinance/recorded-finance/compare/v0.13.0...v0.13.1
[0.13.0]: https://github.com/RecordedFinance/recorded-finance/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/RecordedFinance/recorded-finance/compare/v0.11.3...v0.12.0
[0.11.3]: https://github.com/RecordedFinance/recorded-finance/compare/v0.11.2...v0.11.3
[0.11.2]: https://github.com/RecordedFinance/recorded-finance/compare/v0.11.1...v0.11.2
[0.11.1]: https://github.com/RecordedFinance/recorded-finance/compare/v0.11.0...v0.11.1
[0.11.0]: https://github.com/RecordedFinance/recorded-finance/compare/v0.10.2...v0.11.0
[0.10.2]: https://github.com/RecordedFinance/recorded-finance/compare/v0.10.1...v0.10.2
[0.10.1]: https://github.com/RecordedFinance/recorded-finance/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/RecordedFinance/recorded-finance/compare/v0.9.1...v0.10.0
[0.9.1]: https://github.com/RecordedFinance/recorded-finance/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/RecordedFinance/recorded-finance/compare/v0.8.1...v0.9.0
[0.8.1]: https://github.com/RecordedFinance/recorded-finance/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/RecordedFinance/recorded-finance/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/RecordedFinance/recorded-finance/compare/v0.6.4...v0.7.0
[0.6.4]: https://github.com/RecordedFinance/recorded-finance/compare/v0.6.3...v0.6.4
[0.6.3]: https://github.com/RecordedFinance/recorded-finance/compare/v0.6.2...v0.6.3
[0.6.2]: https://github.com/RecordedFinance/recorded-finance/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/RecordedFinance/recorded-finance/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/RecordedFinance/recorded-finance/compare/v0.5.7...v0.6.0
[0.5.7]: https://github.com/RecordedFinance/recorded-finance/compare/v0.5.6...v0.5.7
[0.5.6]: https://github.com/RecordedFinance/recorded-finance/compare/v0.5.5...v0.5.6
[0.5.5]: https://github.com/RecordedFinance/recorded-finance/compare/v0.5.4...v0.5.5
[0.5.4]: https://github.com/RecordedFinance/recorded-finance/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/RecordedFinance/recorded-finance/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/RecordedFinance/recorded-finance/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/RecordedFinance/recorded-finance/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/RecordedFinance/recorded-finance/compare/v0.4.3...v0.5.0
[0.4.3]: https://github.com/RecordedFinance/recorded-finance/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/RecordedFinance/recorded-finance/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/RecordedFinance/recorded-finance/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/RecordedFinance/recorded-finance/compare/v0.3.4...v0.4.0
[0.3.4]: https://github.com/RecordedFinance/recorded-finance/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/RecordedFinance/recorded-finance/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/RecordedFinance/recorded-finance/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/RecordedFinance/recorded-finance/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/RecordedFinance/recorded-finance/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/RecordedFinance/recorded-finance/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/RecordedFinance/recorded-finance/compare/v0.0.0...v0.1.0
[0.0.0]: https://github.com/RecordedFinance/recorded-finance/releases/tag/v0.0.0
