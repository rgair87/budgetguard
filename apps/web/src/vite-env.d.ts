/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TELLER_ENV?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
