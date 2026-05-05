export function hasSupabaseAdminEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function hasR2Env() {
  return Boolean(
    r2Endpoint() && r2AccessKeyId() && r2SecretAccessKey() && r2BucketName(),
  );
}

export function r2Endpoint() {
  if (process.env.CLOUDFLARE_R2_ENDPOINT) {
    return process.env.CLOUDFLARE_R2_ENDPOINT;
  }

  if (process.env.R2_ACCOUNT_ID) {
    return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  }

  return "";
}

export function r2BucketName() {
  return process.env.CLOUDFLARE_R2_BUCKET_NAME ?? process.env.R2_BUCKET ?? "";
}

export function r2AccessKeyId() {
  return process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID ?? "";
}

export function r2SecretAccessKey() {
  return (
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_ACCESS_KEY ?? ""
  );
}

export function hasAzureSpeechEnv() {
  return Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

export function hasStripeEnv() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

export function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, "https://") ??
    "http://localhost:3000"
  );
}
