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

  it("resolves BETTER_AUTH_URL with highest priority", () => {
    const baseURL = resolveAuthBaseURL({
      BETTER_AUTH_URL: "https://emitdocs.jimfleax.in",
      FRONTEND_URL: "https://other.jimfleax.in",
      VITE_API_BASE_URL: "https://api.jimfleax.in",
    });
    assert.strictEqual(baseURL, "https://emitdocs.jimfleax.in");
  });

  it("resolves FRONTEND_URL when BETTER_AUTH_URL is absent", () => {
    const baseURL = resolveAuthBaseURL({
      FRONTEND_URL: "https://emitdocs.jimfleax.in",
      VITE_API_BASE_URL: "https://api.jimfleax.in",
    });
    assert.strictEqual(baseURL, "https://emitdocs.jimfleax.in");
  });

  it("resolves VITE_API_BASE_URL when higher priority vars are absent", () => {
    const baseURL = resolveAuthBaseURL({
      VITE_API_BASE_URL: "https://emitdocs.vercel.app",
    });
    assert.strictEqual(baseURL, "https://emitdocs.vercel.app");
  });

  it("defaults to canonical production domain in production when env vars are absent", () => {
    const baseURLNodeEnv = resolveAuthBaseURL({ NODE_ENV: "production" });
    assert.strictEqual(baseURLNodeEnv, "https://emitdocs.jimfleax.in");

    const baseURLVercel = resolveAuthBaseURL({ VERCEL: "1" });
    assert.strictEqual(baseURLVercel, "https://emitdocs.jimfleax.in");
  });

  it("defaults to localhost:3000 in development when env vars are absent", () => {
    const baseURL = resolveAuthBaseURL({});
    assert.strictEqual(baseURL, "http://localhost:3000");

    const baseURLDev = resolveAuthBaseURL({ NODE_ENV: "development" });
    assert.strictEqual(baseURLDev, "http://localhost:3000");
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

  it("generates redirect_uri with canonical production domain for Google OAuth", async () => {
    const baseURL = resolveAuthBaseURL({ NODE_ENV: "production" });
    assert.strictEqual(baseURL, "https://emitdocs.jimfleax.in");

    const testAuth = betterAuth({
      baseURL,
      secret: "test-secret-at-least-32-characters-long",
      socialProviders: {
        google: { clientId: "test-client-id", clientSecret: "test-client-secret" },
      },
    });

    const res = await testAuth.api.signInSocial({
      body: { provider: "google", callbackURL: "https://emitdocs.jimfleax.in/app" },
    });

    assert.ok(res?.url);
    const parsed = new URL(res.url);
    assert.strictEqual(
      parsed.searchParams.get("redirect_uri"),
      "https://emitdocs.jimfleax.in/api/auth/callback/google"
    );
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

  describe("Cookie Configuration", () => {
    it("sets SameSite=Lax and Secure=true in production for first-party same-origin cookie", async () => {
      const isProduction = true;
      const prodAuth = betterAuth({
        baseURL: "https://emitdocs.jimfleax.in",
        trustedOrigins: getAllowedOrigins(),
        advanced: {
          trustedProxyHeaders: true,
          defaultCookieAttributes: {
            sameSite: "lax",
            secure: isProduction,
          },
        },
        secret: "test-secret-at-least-32-characters-long",
        socialProviders: {
          google: { clientId: "test-id", clientSecret: "test-secret" },
        },
      });

      const authResponse = await prodAuth.handler(
        new Request("https://emitdocs.jimfleax.in/api/auth/sign-in/social", {
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
      assert.ok(cookieHeader.includes("SameSite=Lax"), "Must set SameSite=Lax in production");
      assert.ok(cookieHeader.includes("Secure"), "Must set Secure flag in production");
    });

    it("sets SameSite=Lax and Secure=false in development for standard localhost workflows", async () => {
      const isProduction = false;
      const devAuth = betterAuth({
        baseURL: "http://localhost:3000",
        trustedOrigins: getAllowedOrigins(),
        advanced: {
          trustedProxyHeaders: true,
          defaultCookieAttributes: {
            sameSite: "lax",
            secure: isProduction,
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
      assert.ok(!cookieHeader.includes("Secure"), "Must not set Secure flag in development");
    });

    it("successfully validates state via database storage even when browser drops state cookie", async () => {
      // In-memory verification storage
      const storage = new Map<string, string>();
      const memoryStorage = {
        get: async (key: string) => storage.get(key) || null,
        set: async (key: string, value: string) => {
          storage.set(key, value);
        },
        delete: async (key: string) => {
          storage.delete(key);
        },
      };

      const statelessAuth = betterAuth({
        baseURL: "https://emitdocs.jimfleax.in",
        trustedOrigins: getAllowedOrigins(),
        secondaryStorage: memoryStorage,
        account: {
          skipStateCookieCheck: true,
        },
        advanced: {
          trustedProxyHeaders: true,
          defaultCookieAttributes: {
            sameSite: "lax",
            secure: true,
          },
        },
        secret: "test-secret-at-least-32-characters-long",
        socialProviders: {
          google: { clientId: "test-id", clientSecret: "test-secret" },
        },
      });

      // Initiate sign-in
      const initRes = await statelessAuth.handler(
        new Request("https://emitdocs.jimfleax.in/api/auth/sign-in/social", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            provider: "google",
            callbackURL: "https://emitdocs.jimfleax.in/app",
          }),
        })
      );

      const initData = await initRes.json();
      assert.ok(initData?.url, "Must generate authorization URL");
      const state = new URL(initData.url).searchParams.get("state");
      assert.ok(state, "State token must be generated");

      // Verify that the state was stored in the verification storage
      assert.ok(storage.size > 0, "Verification state must be stored in database/secondary storage");

      // Simulate OAuth callback with NO cookie (cross-site cookie dropped by browser)
      const callbackRes = await statelessAuth.handler(
        new Request(
          `https://emitdocs.jimfleax.in/api/auth/callback/google?state=${state}&code=test_code`,
          {
            method: "GET",
          }
        )
      );

      // The callback must NOT redirect with error=state_mismatch
      const location = callbackRes.headers.get("location") || "";
      assert.ok(
        !location.includes("error=state_mismatch"),
        `Callback must not produce state_mismatch when skipStateCookieCheck is true. Got location: ${location}`
      );
    });
  });
});
