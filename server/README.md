# Recorded Finance Server

The machine that stores stuff.

> This project is undergoing rapid development and should be considered experimental. Use it at your own risk. 🤙

## API

This server doesn't do much on its own once you're authenticated. You give it data, and you ask for that data back. If you want to encrypt that data, do that yourself before you send it.

The API is documented using [OpenAPI](https://petstore.swagger.io/?url=https://raw.githubusercontent.com/AverageHelper/recorded-finance/main/server/openapi.yaml).

## Setup

### Prerequesites

This project requires Node 16 and NPM v7 or above. You can check what versions you have installed by running `npm -v` and `node -v`:

```sh
$ npm -v && node -v
8.1.2
v16.13.1
```

The server supports self-hosting out of the box using Express. If you wish to host the back-end using Vercel Serverless Functions, you should set up an account with [Vercel](https://vercel.com) and [PubNub](https://www.pubnub.com).

### Compile and Run the Server

- Clone the repository
- Create a .env file at the root of the `server` folder, like the one shown below:

```sh
# .env

# A secret value used to sign JWTs and generate TOTP secrets. Keep this safe.
# Consider generating this value with https://bitwarden.com/password-generator/
AUTH_SECRET={some random string of characters}
# required, example: "wAheb^8v^YV^s6YaeYVW&8tyLa*ce4"

# Where your MySQL server can be accessed
DATABASE_URL={your MySQL connection string}
# required, example: "mysql://....connect.psdb.cloud/..."

HOST={your frontend hostname, with protocol}
# required, example: HOST=https://example.com

MAX_USERS={the limit to the number of users allowed to register new accounts}
# optional, defaults to 5

MAX_BYTES={the total number of bytes that file attachments are permitted to occupy on the system}
# optional, defaults to 20000000000 (20 GB)

PUBNUB_PUBLISH_KEY={publish key given by PubNub}
# optional with Express, required with Vercel, key given by PubNub

PUBNUB_SUBSCRIBE_KEY={subscribe key given by PubNub}
# optional with Express, required with Vercel, key given by PubNub

PUBNUB_SECRET_KEY={secret key given by PubNub}
# optional with Express, required with Vercel, key given by PubNub
```

Run these commands to compile and run

```sh
$ cd recorded-finance/server  # Be in the server directory (if you aren't already)
$ npm ci                     # Install dependencies
$ npm run build              # Compile the server
$ node .                     # Start the server in development mode
```

Alternatively, if you want to try a local Vercel environment, run `npm start` instead of `node .`.

I recommend using something like [PM2](https://pm2.keymetrics.io) to run the server properly. (Instructions coming soon™)

## Contributing

This project is entirely open source. Do with it what you will. If you're willing to help me improve this project, consider [filing an issue](https://github.com/AverageHelper/recorded-finance/issues/new/choose).

See [CONTRIBUTING.md](/CONTRIBUTING.md) for ways to contribute.
