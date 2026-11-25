/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Sent as the x-api-key header when set at build time; left unset when the API runs with the key check off.
  readonly VITE_API_KEY?: string;
}
