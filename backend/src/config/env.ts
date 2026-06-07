const required = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
};

export const env = {
  port:           parseInt(process.env.PORT || "8000", 10),
  nodeEnv:        process.env.NODE_ENV || "development",
  jwtSecret:      required("JWT_SECRET"),
  frontendUrl:    process.env.FRONTEND_URL || "http://localhost:80",
  googleApiKey:   required("GOOGLE_API_KEY"),
  n8nWebhookUrl:  required("N8N_WEBHOOK_URL"),
  indexerUrl:     process.env.INDEXER_URL || "http://indexer:5000",
  indexerSecret:  required("INDEXER_SECRET"),
  databaseUrl:    required("DATABASE_URL"),
  gmailUser:        required("GMAIL_USER"),
  gmailAppPassword: required("GMAIL_APP_PASSWORD"),
  reportRecipient:  required("REPORT_RECIPIENT"),
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
} as const;

export const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000; // 8 jam
export const JWT_EXPIRES_IN = "8h";
export const UPLOAD_MAX_SIZE_MB = 10;
export const DOCS_MAX_SIZE_MB = 50;
export const SESSION_MAX_ROWS = 40;
