const fallbackAppUrl = "https://tanuki.nodetech.jp";

export const appConfig = {
  appUrl: normalizeUrl(process.env.EXPO_PUBLIC_APP_URL ?? fallbackAppUrl),
};

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "");
}
