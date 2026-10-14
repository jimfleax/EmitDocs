import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { db } from "./lib/db.js";
import { getAllowedOrigins } from "./lib/origins.js";
import 'dotenv/config';

export const auth = betterAuth({
  database: mongodbAdapter(db),
  trustedOrigins: getAllowedOrigins(),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
});
