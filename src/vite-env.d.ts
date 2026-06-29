/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_USE_MOCKS: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_INTER_API_URL: string;
  readonly VITE_INTER_CLIENT_ID: string;
  readonly VITE_INTER_CLIENT_SECRET: string;
  readonly VITE_INTER_PIX_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
