export const config = { runtime: "edge" };

const BACKEND_URL = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

const HEADERS_TO_REMOVE = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

export default async function tunnel(req) {
  if (!BACKEND_URL) {
    return new Response("Misconfigured: TARGET_DOMAIN is not set", { status: 500 });
  }

  try {
    const pathStart = req.url.indexOf("/", 8);
    const destinationUrl =
      pathStart === -1 
        ? BACKEND_URL + "/" 
        : BACKEND_URL + req.url.slice(pathStart);

    const newHeaders = new Headers();
    let realClientIp = null;

    for (const [key, value] of req.headers) {
      if (HEADERS_TO_REMOVE.has(key)) continue;
      if (key.startsWith("x-vercel-")) continue;

      if (key === "x-real-ip") {
        realClientIp = value;
        continue;
      }
      if (key === "x-forwarded-for") {
        if (!realClientIp) realClientIp = value;
        continue;
      }
      newHeaders.set(key, value);
    }

    if (realClientIp) {
      newHeaders.set("x-forwarded-for", realClientIp);
    }

    const httpMethod = req.method;
    const hasRequestBody = httpMethod !== "GET" && httpMethod !== "HEAD";

    return await fetch(destinationUrl, {
      method: httpMethod,
      headers: newHeaders,
      body: hasRequestBody ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });
  } catch (error) {
    console.error("Tunnel error:", error);
    return new Response("Bad Gateway: Tunnel Failed", { status: 502 });
  }
}
