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
TELEGRAM_BOT_USERNAME="hrmdiplomabot"
TELEGRAM_WEBHOOK_SECRET=""
TELEGRAM_USE_POLLING="true"
BOT_LINK_CODE_TTL_MINUTES="15"
STATUS_CHECK_TIMEZONE="Europe/Moscow"

# AI assistant (optional — rule-based fallback works without a key)
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o-mini"
OPENAI_BASE_URL="https://api.openai.com/v1"
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
   - `TELEGRAM_BOT_USERNAME` — bot username without `@` (example: `hrmdiplomabot`)
   - `TELEGRAM_USE_POLLING=true` — for local dev (no webhook/ngrok needed)
   - `STATUS_CHECK_TIMEZONE=Europe/Moscow` — daily prompt schedule
3. Start the API: `npm start`
4. In the HRM app profile, enter the employee Telegram `@username` and open the returned deep link.
5. Telegram opens with `/start <token>` and links the account automatically.

### Daily status enforcement (Europe/Moscow)

| Time | Action |
|------|--------|
| 09:00 | Send status buttons to all linked Telegram accounts |
| 10:00, 11:00 | Remind users who have not confirmed today's status |
| 12:00 | Force-logout users with linked Telegram who still have not confirmed |

Random Telegram users who find the bot cannot use it. They must connect from the HRM app first.

### GraphQL

```graphql
mutation LinkTelegram($username: String!) {
  linkTelegramAccount(input: { username: $username }) {
    deepLink
    botUsername
    expiresAt
  }
}

query {
  telegramLinkStatus {
    linked
    telegramUsername
    botUsername
  }
}
```

### Production webhook

Register the webhook with Telegram (replace values):

```sh
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://your-api-host/api/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Set `TELEGRAM_USE_POLLING=false` (or remove it) in production.

## AI assistant

The backend includes optional AI features:

- **Telegram natural language** — linked users can write status in plain text (e.g. “working remotely”, «в отпуске»). Rule-based parsing always works; set `OPENAI_API_KEY` to enable LLM fallback for ambiguous phrases.
- **Web HR assistant** — GraphQL query `askHrAssistant` on the Team availability page. Answers are grounded in live team availability data; without an API key, rule-based responses are used.
- **Project creation assistant** — GraphQL query `suggestProject` (Admin only) on the Projects catalog create dialog. Suggests name, domain, description, and environment stack from the skills catalog.

```graphql
query {
  askHrAssistant(input: { question: "Who is in the office?", locale: "en" }) {
    answer
    source
  }
}

query {
  suggestProject(input: {
    brief: "HR portal with React and GraphQL"
    locale: "en"
  }) {
    name
    domain
    description
    environment
    source
  }
}
```

## Production

Current production URL https://cv-project-js.inno.ws/api/graphql. \
Application should be exposed on port 80 and 443.
