declare global {
  namespace NodeJS {
    interface ProcessEnv {
      AUTH_ORGANIZATION_ID: string;
      AUTH_SECRET: string;
      AUTH_BASE_URL: string;
    }
  }
}

export { };
