## Local Environment

These variables are recommended for local development:

```sh
PORT="3001"
DATABASE_URL="postgres://user:password@host:port/name"
DATABASE_SSL=""
JWT_SECRET=""
JWT_SECRET_2=""
CLOUDINARY_URL="cloudinary://key:secret@name"
MAIL_FROM=""
SMTP_URL="smtp://user:password@host:port"
CHROME_WS="wss://url"
SENTRY_DSN_URL="https://url"

# Telegram availability bot (optional)
TELEGRAM_BOT_TOKEN=""
TELEGRAM_WEBHOOK_SECRET=""
TELEGRAM_USE_POLLING="true"
BOT_LINK_CODE_TTL_MINUTES="15"
```

## Local Database & Docker

You should have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed.
Then you can use:

### `npm run image`

Creates docker image for this application.

### `npm run image:up`

Creates docker container with local PostgreSQL database. You can inspect database table entities with pgAdmin 4.\
Runs previously created image in another docker container connected to the database.

## GraphQL SDL-first

This project use Schema-first approach.\
TypeScript output is published as npm package https://www.npmjs.com/package/cv-graphql.

## Available Scripts

In the project directory, you can run:

### `npm run schema`

Creates type definitions for GraphQL.

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3001/api/graphql](http://[::1]:3001/api/graphql) to access GraphQL playground.

### `npm run build`

Builds the app for production to the `dist` folder.

## Telegram availability bot

The backend includes a Telegram bot for updating employee availability (on shift, sick, vacation, etc.).

### Setup

1. Create a bot with [@BotFather](https://t.me/BotFather) and copy the token.
2. Add to your env file:
   - `TELEGRAM_BOT_TOKEN` — bot token from BotFather
   - `TELEGRAM_USE_POLLING=true` — for local dev (no webhook/ngrok needed)
   - `TELEGRAM_WEBHOOK_SECRET` — optional secret for production webhook
3. Start the API: `npm start`
4. In the HRM app, call the `generateBotLinkCode` mutation while logged in.
5. In Telegram, send `/link <code>` to your bot, then use the menu buttons.

### Production webhook

Register the webhook with Telegram (replace values):

```sh
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://your-api-host/api/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Set `TELEGRAM_USE_POLLING=false` (or remove it) in production.

## Production

Current production URL https://cv-project-js.inno.ws/api/graphql. \
Application should be exposed on port 80 and 443.
