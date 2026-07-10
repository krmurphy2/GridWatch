// In dev the app is often reached through a proxy / port-forward (Cascade browser
// preview, Codespaces, etc.), so the request `origin` differs from the
// `x-forwarded-host` Next.js sees. Next 14 blocks Server Actions on that mismatch
// unless the origin is explicitly allowed. Extra origins can be supplied via the
// SERVER_ACTIONS_ALLOWED_ORIGINS env var (comma-separated host[:port] values).
const extraAllowedOrigins = (process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
      allowedOrigins: [
        "localhost:3000",
        "127.0.0.1:3000",
        "127.0.0.1:33199",
        "*.app.github.dev",
        "*.githubpreview.dev",
        "*.gitpod.io",
        ...extraAllowedOrigins
      ]
    }
  }
};

export default nextConfig;
