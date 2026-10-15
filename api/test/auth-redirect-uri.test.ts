import assert from "node:assert";
import { describe, it } from "node:test";
import { resolveAuthBaseURL } from "../src/lib/auth-url.js";
import { getAllowedOrigins } from "../src/lib/origins.js";
import { betterAuth } from "better-auth";

describe("OAuth Redirect URI & Base URL Resolution", () => {
  it("resolves localhost when VITE_API_BASE_URL is localhost", async () => {
    const baseURL = resolveAuthBaseURL({ VITE_API_BASE_URL: "http://localhost:3000" });
    assert.strictEqual(baseURL, "http://localhost:3000");

    const testAuth = betterAuth({
      baseURL,
      secret: "test-secret-at-least-32-characters-long",
      socialProviders: {
        google: { clientId: "test-client-id", clientSecret: "test-client-secret" },
      },
    });

    const res = await testAuth.api.signInSocial({
      body: { provider: "google", callbackURL: "http://localhost:5173/app" },
    });

    assert.ok(res?.url);
    const parsed = new URL(res.url);
    assert.strictEqual(
      parsed.searchParams.get("redirect_uri"),
      "http://localhost:3000/api/auth/callback/google"
    );
  });

  it("resolves deployed production URL when VITE_API_BASE_URL is deployed domain", async () => {
    const baseURL = resolveAuthBaseURL({ VITE_API_BASE_URL: "https://emitdocs.vercel.app" });
    assert.strictEqual(baseURL, "https://emitdocs.vercel.app");

    const testAuth = betterAuth({
      baseURL,
      secret: "test-secret-at-least-32-characters-long",
      socialProviders: {
        google: { clientId: "test-client-id", clientSecret: "test-client-secret" },
      },
    });

    const res = await testAuth.api.signInSocial({
      body: { provider: "google", callbackURL: "https://emitdocs.vercel.app/app" },
    });

    assert.ok(res?.url);
    const parsed = new URL(res.url);
    assert.strictEqual(
      parsed.searchParams.get("redirect_uri"),
      "https://emitdocs.vercel.app/api/auth/callback/google"
    );
  });

  it("normalizes and strips trailing /api or slash to prevent broken callback URLs", () => {
    const baseURLWithApi = resolveAuthBaseURL({ VITE_API_BASE_URL: "http://localhost:3000/api" });
    assert.strictEqual(baseURLWithApi, "http://localhost:3000");

    const baseURLWithSlash = resolveAuthBaseURL({ VITE_API_BASE_URL: "https://emitdocs.vercel.app/" });
    assert.strictEqual(baseURLWithSlash, "https://emitdocs.vercel.app");

    const baseURLWithApiSlash = resolveAuthBaseURL({ VITE_API_BASE_URL: "https://emitdocs.vercel.app/api/" });
    assert.strictEqual(baseURLWithApiSlash, "https://emitdocs.vercel.app");

    const baseURLWithTrailingApiSlashes = resolveAuthBaseURL({ VITE_API_BASE_URL: "http://localhost:3000/api//" });
    assert.strictEqual(baseURLWithTrailingApiSlashes, "http://localhost:3000");
  });

  it("falls back to BETTER_AUTH_URL if VITE_API_BASE_URL is missing", () => {
    const baseURL = resolveAuthBaseURL({ BETTER_AUTH_URL: "https://api.emitdocs.com" });
    assert.strictEqual(baseURL, "https://api.emitdocs.com");
  });

  it("falls back when environment variables contain only whitespace", () => {
    const baseURL = resolveAuthBaseURL({
      VITE_API_BASE_URL: "   ",
      BETTER_AUTH_URL: " \t\n ",
    });
    assert.strictEqual(baseURL, "http://localhost:3000");

    const baseURLWithFallback = resolveAuthBaseURL({
      VITE_API_BASE_URL: "   ",
      BETTER_AUTH_URL: " https://api.emitdocs.com ",
    });
    assert.strictEqual(baseURLWithFallback, "https://api.emitdocs.com");
  });

  it("falls back to default localhost:3000 when both variables are absent", () => {
    const baseURL = resolveAuthBaseURL({});
    assert.strictEqual(baseURL, "http://localhost:3000");
  });

  it("includes resolved auth base URL origin in allowed origins", () => {
    const originalViteUrl = process.env.VITE_API_BASE_URL;
    try {
      process.env.VITE_API_BASE_URL = "https://custom-auth.example.com/api//";
      const allowed = getAllowedOrigins();
      assert.ok(
        allowed.includes("https://custom-auth.example.com"),
        "Allowed origins should include resolved auth baseURL origin"
      );
    } finally {
      process.env.VITE_API_BASE_URL = originalViteUrl;
    }
  });

  it("always includes https://emitdocs.jimfleax.in in allowed origins", () => {
    const allowed = getAllowedOrigins();
    assert.ok(
      allowed.includes("https://emitdocs.jimfleax.in"),
      "Allowed origins must include production custom domain emitdocs.jimfleax.in"
    );
  });

  describe("Cross-Domain Cookie Configuration", () => {
    it("sets SameSite=None and Secure=true in production for cross-domain cookie acceptance", async () => {
      const prodAuth = betterAuth({
        baseURL: "https://emitdocs-api.vercel.app",
        trustedOrigins: getAllowedOrigins(),
        advanced: {
          trustedProxyHeaders: true,
          defaultCookieAttributes: {
            sameSite: "none",
            secure: true,
          },
        },
        secret: "test-secret-at-least-32-characters-long",
        socialProviders: {
          google: { clientId: "test-id", clientSecret: "test-secret" },
        },
      });

      const res = await prodAuth.api.signInSocial({
        body: {
          provider: "google",
          callbackURL: "https://emitdocs.jimfleax.in/app",
        },
      });

      assert.ok(res?.url);
      // When invoked through API handler, headers or response sets cookie
      const authResponse = await prodAuth.handler(
        new Request("https://emitdocs-api.vercel.app/api/auth/sign-in/social", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            provider: "google",
            callbackURL: "https://emitdocs.jimfleax.in/app",
          }),
        })
      );

      const cookieHeader = authResponse.headers.get("set-cookie");
      assert.ok(cookieHeader, "Must set state cookie");
      assert.ok(cookieHeader.includes("SameSite=None"), "Must set SameSite=None in production");
      assert.ok(cookieHeader.includes("Secure"), "Must set Secure flag when SameSite=None");
    });

    it("sets SameSite=Lax in development for standard localhost workflows", async () => {
      const devAuth = betterAuth({
        baseURL: "http://localhost:3000",
        trustedOrigins: getAllowedOrigins(),
        advanced: {
          trustedProxyHeaders: true,
          defaultCookieAttributes: {
            sameSite: "lax",
            secure: false,
          },
        },
        secret: "test-secret-at-least-32-characters-long",
        socialProviders: {
          google: { clientId: "test-id", clientSecret: "test-secret" },
        },
      });

      const authResponse = await devAuth.handler(
        new Request("http://localhost:3000/api/auth/sign-in/social", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            provider: "google",
            callbackURL: "http://localhost:5173/app",
          }),
        })
      );

      const cookieHeader = authResponse.headers.get("set-cookie");
      assert.ok(cookieHeader, "Must set state cookie");
      assert.ok(cookieHeader.includes("SameSite=Lax"), "Must set SameSite=Lax in development");
    });
  });
});
