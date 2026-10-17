/**
 * @file production-guard.ts
 * @description Fail-closed environment validation and test-auth guard for production runtime.
 */

export interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  MONGODB_URI: string;
  DB_NAME: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  ALLOWED_ORIGINS: string[];
  ENABLE_TEST_AUTH: boolean;
}

export class ConfigurationError extends Error {
  code: string;
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
    this.code = 'CONFIG_VALIDATION_FAILED';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

export function validateEnvironment(env: Record<string, string | undefined> = process.env): EnvConfig {
  const isProd = env.NODE_ENV === 'production';
  const enableTestAuth = env.ENABLE_TEST_AUTH === 'true';

  // Invariant: Test auth strictly prohibited in production
  if (isProd && enableTestAuth) {
    throw new ConfigurationError('FATAL: ENABLE_TEST_AUTH cannot be true when NODE_ENV is production');
  }

  const requiredInProd = [
    'MONGODB_URI',
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'ALLOWED_ORIGINS',
  ];

  if (isProd) {
    const missing = requiredInProd.filter((key) => !env[key] || env[key]?.trim() === '');
    if (missing.length > 0) {
      throw new ConfigurationError(`Missing mandatory production environment variables: ${missing.join(', ')}`);
    }
  }

  return {
    NODE_ENV: env.NODE_ENV || 'development',
    PORT: Number(env.PORT) || 3000,
    MONGODB_URI: env.MONGODB_URI || '',
    DB_NAME: env.DB_NAME || 'emitdocs',
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET || '',
    BETTER_AUTH_URL: env.BETTER_AUTH_URL || 'http://localhost:3000',
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID || '',
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET || '',
    CLOUDINARY_CLOUD_NAME: env.CLOUDINARY_CLOUD_NAME || '',
    CLOUDINARY_API_KEY: env.CLOUDINARY_API_KEY || '',
    CLOUDINARY_API_SECRET: env.CLOUDINARY_API_SECRET || '',
    ALLOWED_ORIGINS: env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()) : ['http://localhost:5173'],
    ENABLE_TEST_AUTH: enableTestAuth,
  };
}
