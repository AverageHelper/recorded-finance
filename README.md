# Accountable

[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/AverageHelper/accountable-svelte.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/AverageHelper/accountable-svelte/context:javascript) [![Total alerts](https://img.shields.io/lgtm/alerts/g/AverageHelper/accountable-svelte.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/AverageHelper/accountable-svelte/alerts/)

A Svelte app for managing monetary assets. All data is encrypted client-side and stored on a server that you control.

> This project is undergoing rapid development and should be considered experimental. Use it at your own risk. 🤙

### Alternative Projects

There are many open-source balance keepers out there, but none I've found that I quite like. A few are listed [here](https://opensource.com/life/17/10/personal-finance-tools-linux).

### The Goal

The aim of Accountable is to be cross-platform and portable. Eventually, I plan to have an Android client on the F-droid store, an iOS app on the App Store, and a website as well. The self-host option will always be available, and I intend for this project to always be open-source.

## Setup

### Prerequesites

To run the app in your browser, you'll need one of the following browsers and versions:

- Chrome >=87
- Firefox >=78
- Safari >=13
- Edge >=88

(I've not tested any of these boundaries, but [Vite.js recommends them](https://vitejs.dev/guide/migration.html#modern-browser-baseline-change).)

Developing for this project requires Node 16.5 and NPM v7 or above. You can check what versions you have installed by running `npm -v` and `node -v`:

```sh
$ npm -v && node -v
8.1.2
v16.13.1
```

### Compile and Run the Server

See [the server's README](/server/README.md) for info on that.

<!-- TODO: Add a note here about our own hosted solution -->

### Compile and Run the Client

- Clone the repository
- Create a .env file at the root of the project, like the one shown below:

```sh
# .env

# Where your server lives
VITE_ACCOUNTABLE_SERVER_URL={your Accountable backend URL here}:40850

# Enable the "Login" menu item
VITE_ENABLE_LOGIN=true

# Enable the "signup" behaviors
VITE_ENABLE_SIGNUP=false
```

If you're hosting the Accountable server on the same machine that hosts the Accountable client, do NOT use `localhost` for the `VITE_ACCOUNTABLE_SERVER_URL`. You must set this to a URL that _clients_—that is, web browsers—can use to access your Accountable backend.

Using `localhost` for this will cause clients to try _themselves_ as the Accountable server, and that's usually not what you want.

```sh
$ cd accountable-svelte          # Be in the root directory
$ npm ci                      # Install dependencies
$ npm run build:client:quick  # Compile the client
$ npm run dev:client          # Start a local webserver
```

> Note: The build script injects your .env values at build time. If you must change .env, remember to re-build the client.

The webserver will print a URL in your terminal to paste into your browser. It should look something like [http://127.0.0.1:5173](http://127.0.0.1:5173). Give that a go, and you're off to the races!

I recommend you deploy the client (the contents of the `accountable-svelte/dist` folder) on a webserver like [nginx](https://nginx.org/en/).

DO NOT FORGET your Accountable ACCOUNT ID or PASSWORD. If you do, your data is irretrievably lost. You have been warned. :)

## Acknowledgements

- Icons from [iconmonstr](https://iconmonstr.com/)

## Contributing

This project is entirely open source. Do with it what you will. If you're willing to help me improve this project, consider [filing an issue](https://github.com/AverageHelper/accountable-svelte/issues/new/choose).

See [CONTRIBUTING.md](/CONTRIBUTING.md) for ways to contribute.

## FAQ

Some questions I've asked myself while developing this. You might have these questions too!

### Why use cookies?

JavaScript is not a safe spot to store cookies. The nascent versions of Accountable's front-end client stored the user's login token in a JavaScript variable. I later learned a better way: don't handle the token myself, let the browser handle it with [standard cookie security APIs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#restrict_access_to_cookies).

Accountable's back-end server still responds to successful login requests with the token in the response body, but the server also now asks requesting clients to set the token as a cookie with the following attributes:
- `HttpOnly` - According to [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#restrict_access_to_cookies): "A cookie with the HttpOnly attribute is inaccessible to the JavaScript [`Document.cookie`](https://developer.mozilla.org/en-US/docs/Web/API/Document/cookie) API; it's only sent to the server. For example, cookies that persist in server-side sessions _don't need to be available to JavaScript_ and should have the `HttpOnly` attribute. This precaution helps mitigate cross-site scripting ([XSS](https://developer.mozilla.org/en-US/docs/Web/Security/Types_of_attacks#cross-site_scripting_(xss))) attacks." (emphasis mine)
- `Secure` - Not set if the server is running on `localhost`. According to [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#restrict_access_to_cookies): "A cookie with the Secure attribute is only sent to the server with an encrypted request over the HTTPS protocol."

If create your own Accountable client, please don't mishandle the token. If you dig back in our git history to find and use a version that uses the old JavaScript way, know that you may be getting into avoidable security vulnerabilities.

### Why disclose cookies?

I've heard that GDPR doesn't care about "session" cookies, and therefore don't need to be disclosed.

While our cookies indeed deal with the user's login "session," [GDPR.edu](https://gdpr.eu/cookies/) defines "session cookies" as cookies that "are temporary and expire once you close your browser (or once your session ends)." Since our cookies persist between browser sessions, I need to disclose them.

`Secure` cookies are also hidden to most browsers' devtools. (I might post screenshots later of what I mean by this). This means that most users won't see our cookies on their browser. However, our cookies are not set with the `Secure` attribute if the login request comes from an HTTP source, such as `localhost`. These cookies _will_ appear in some browsers' devtools. To avoid confusion, and as a point of principle, I want to make clear to savvy users what's happening here.

### How do releases work?

The manual way is complicated: add a version entry to [CHANGELOG.md](/CHANGELOG.md), straighten out the not-yet-valid URLs in the changelog footer, update [package.json](/package.json) and [package-lock.json](/package-lock.json) (the latter using `npm i`), then merge the PR, then copy the changelog entry to cut a new [Release](https://github.com/AverageHelper/accountable-svelte/releases) and tag using GitHub's UI. The changelog's version links now point to the relevant newly-created tags.

I've missed some steps before. For example, version [0.9.0](/CHANGELOG.md#090---2022-07-12) didn't originally have a tag, so related comparison links were broken. Not ideal. Since we use [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), we can automate most of our release steps, as follows:

1. I create a version entry in [CHANGELOG.md](/CHANGELOG.md). If I'm ready to merge to main but not yet ready to cut the release, I call the version `"Unreleased"`, and the tooling ignores that version.
2. When I'm ready to cut the release, I rename `"Unreleased"` to the next [SemVer](https://semver.org/spec/v2.0.0.html)-appropriate number.
3. I run `npm run release`, which fixes the changelog's footer links and bumps the `version` in [package.json](/package.json) and [package-lock.json](/package-lock.json).
4. I push a PR.
	- The CI (Continuous Integration) bots check that there's a new version in the changelog, and if so, check that I've run `npm run release` on the branch. (The usual CI checks also occur.)
5. I merge the PR.
	- The CD (Continuous Deployment) bots dispatch a new git tag and GitHub Release using the content of the [CHANGELOG.md](/CHANGELOG.md).

Once the release is tagged and deployed, it's up to server maintainers (including me) to pull down the latest changes. I might do something about that later.
