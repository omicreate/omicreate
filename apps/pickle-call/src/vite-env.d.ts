/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COUNTER_URL?: string
  readonly VITE_PUBLIC_URL?: string
  readonly VITE_NO_SW?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
