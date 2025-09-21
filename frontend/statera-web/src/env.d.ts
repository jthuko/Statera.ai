interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;   // e.g. http://localhost:5198
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
