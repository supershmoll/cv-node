declare namespace NodeJS {
  interface ProcessEnv {
    PORT: string;
    DATABASE_URL: string;
    DATABASE_SSL?: string;
    JWT_SECRET: string;
    JWT_SECRET_2: string;
    CLOUDINARY_URL: string;
    MAIL_FROM?: string;
    RESEND_API_KEY?: string;
    SMTP_URL: string;
    CHROME_WS: string;
    SENTRY_DSN_URL?: string;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_WEBHOOK_SECRET?: string;
    TELEGRAM_USE_POLLING?: string;
    BOT_LINK_CODE_TTL_MINUTES?: string;
    TELEGRAM_BOT_USERNAME?: string;
    STATUS_CHECK_TIMEZONE?: string;
  }
}
