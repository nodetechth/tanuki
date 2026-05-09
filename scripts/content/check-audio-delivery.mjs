import process from "node:process";

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help || !options.url) {
    printUsage();
    process.exitCode = options.help ? 0 : 1;
    return;
  }

  const url = String(options.url);
  const origin = String(options.origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  const headResult = await requestHead(url, origin);
  const rangeResult = await requestRange(url, origin);
  const checks = buildChecks({ headResult, rangeResult, origin });
  const report = {
    url,
    origin,
    checkedAt: new Date().toISOString(),
    head: headResult,
    range: rangeResult,
    checks,
    ok: checks.every((check) => check.ok),
  };

  console.log(JSON.stringify(report, null, 2));

  if (!report.ok) {
    process.exitCode = 1;
  }
}

async function requestHead(url, origin) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: { Origin: origin },
    });
    return responseSummary(response);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function requestRange(url, origin) {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Origin: origin,
        Range: "bytes=0-1",
      },
    });
    const body = await response.arrayBuffer();
    return {
      ...responseSummary(response),
      bytesRead: body.byteLength,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function responseSummary(response) {
  return {
    ok: response.ok,
    status: response.status,
    headers: {
      accessControlAllowOrigin: response.headers.get("access-control-allow-origin"),
      acceptRanges: response.headers.get("accept-ranges"),
      contentRange: response.headers.get("content-range"),
      contentLength: response.headers.get("content-length"),
      contentType: response.headers.get("content-type"),
      etag: response.headers.get("etag"),
    },
  };
}

function buildChecks({ headResult, rangeResult, origin }) {
  const rangeHeaders = rangeResult.headers ?? {};
  const headHeaders = headResult.headers ?? {};
  const corsHeader =
    rangeHeaders.accessControlAllowOrigin ?? headHeaders.accessControlAllowOrigin ?? "";
  const contentType = rangeHeaders.contentType ?? headHeaders.contentType ?? "";
  const acceptRanges = rangeHeaders.acceptRanges ?? headHeaders.acceptRanges ?? "";
  const contentRange = rangeHeaders.contentRange ?? "";

  return [
    {
      name: "HEAD request is readable",
      ok: headResult.status === 200 || headResult.status === 206,
      detail: `status=${headResult.status ?? "error"}`,
    },
    {
      name: "Range request returns partial content",
      ok: rangeResult.status === 206,
      detail: `status=${rangeResult.status ?? "error"}, content-range=${contentRange || "none"}`,
    },
    {
      name: "CORS allows the app origin",
      ok: corsHeader === "*" || corsHeader === origin,
      detail: `access-control-allow-origin=${corsHeader || "none"}`,
    },
    {
      name: "Audio seeking headers are present",
      ok: acceptRanges.toLowerCase().includes("bytes") || contentRange.startsWith("bytes "),
      detail: `accept-ranges=${acceptRanges || "none"}, content-range=${contentRange || "none"}`,
    },
    {
      name: "Content-Type is audio",
      ok: contentType.startsWith("audio/"),
      detail: `content-type=${contentType || "none"}`,
    },
  ];
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = "true";
    } else {
      options[key] = next;
      index += 1;
    }
  }
  return options;
}

function printUsage() {
  console.log(`
Usage:
  npm run audio:check-delivery -- --url <audio-url> --origin <app-origin>

Examples:
  npm run audio:check-delivery -- --url https://audio.example.com/listening/article-id/article-id-us-eleven_multilingual_v2.mp3 --origin http://localhost:3000
  npm run audio:check-delivery -- --url https://audio.example.com/listening/article-id/article-id-us-eleven_multilingual_v2.mp3 --origin https://tanuki.nodetech.jp
`.trim());
}
