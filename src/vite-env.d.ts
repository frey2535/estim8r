/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_BUILDR_URL?: string;
  readonly VITE_BUILDR_API_URL?: string;
  readonly VITE_APP_BUILD_SHA?: string;
  readonly VITE_BASE44_APP_ID?: string;
  readonly VITE_BASE44_FUNCTIONS_VERSION?: string;
  readonly VITE_BASE44_APP_BASE_URL?: string;
  readonly VITE_ESTIM8R_PURCHASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "pdfjs-dist/build/pdf.worker.mjs?url" {
  const pdfWorkerUrl: string;
  export default pdfWorkerUrl;
}
