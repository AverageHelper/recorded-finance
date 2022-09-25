# Accountable Server

The machine that stores stuff.

> This project is undergoing rapid development and should be considered experimental. Use it at your own risk. 🤙

## API

This server doesn't do much on its own once you're authenticated. You give it data, and you ask for that data back. If you want to encrypt that data, do that yourself before you send it.

The API is documented using [OpenAPI](https://petstore.swagger.io/?url=https://raw.githubusercontent.com/AverageHelper/accountable-svelte/main/server/openapi.yaml).

## Setup

### Prerequesites

This project requires Node 16 and NPM v7 or above. You can check what versions you have installed by running `npm -v` and `node -v`:

```sh
$ npm -v && node -v
8.1.2
v16.13.1
```

### Compile and Run the Server

- Clone the repository
- Create a .env file at the root of the `server` folder, like the one shown below:

```sh
# .env

# A secret value used to sign JWTs and generate TOTP secrets. Keep this safe.
# Consider generating this value with https://bitwarden.com/password-generator/
AUTH_SECRET={some random string of characters}
# required, example: "wAheb^8v^YV^s6YaeYVW&8tyLa*ce4"

# Where your MongoDB instance can be accessed
DATABASE_URL={your MongoDB connection string}
# required, example: "mongodb+srv://...mongodb.net/..."

DB={path to your storage directory} # For attachment data
# required, example: "~/server/db"

HOST={your frontend hostname, with protocol}
# required, example: HOST=https://example.com

MAX_USERS={the limit to the number of users allowed to register new accounts}
# optional, defaults to 5

MAX_BYTES={the total number of bytes that Accountable attachments are permitted to occupy on the system}
# optional, defaults to 20000000000 (20 GB)
```

Run these commands to compile and run

```sh
$ cd accountable-svelte/server  # Be in the server directory (if you aren't already)
$ npm ci                     # Install dependencies
$ npm run build              # Compile the server
$ node .                     # Start the server in development mode
```

I recommend using something like [PM2](https://pm2.keymetrics.io) to run the server properly. (Instructions coming soon™)

## Contributing

This project is entirely open source. Do with it what you will. If you're willing to help me improve this project, consider [filing an issue](https://github.com/AverageHelper/accountable-svelte/issues/new/choose).

See [CONTRIBUTING.md](/CONTRIBUTING.md) for ways to contribute.
