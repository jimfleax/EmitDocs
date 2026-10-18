/**
 * @file cloudinary.ts
 * @description Cloudinary Node SDK initialization and configuration singleton.
 * @architecture Configures API credentials for authenticated storage operations, PDF thumbnail generation,
 *               asset signing for client direct uploads, and asset streaming proxying.
 * @agent_note Assets in EmitDocs are uploaded with `type: 'authenticated'` and scoped into `templates/{ownerId}/`
 *             folders. Never generate public unsigned URLs for user documents.
 */

import { v2 as cloudinary } from 'cloudinary';
import 'dotenv/config';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * @module cloudinary
 * @desc Configured Cloudinary v2 SDK instance.
 * @description Configured Cloudinary v2 SDK instance.
 */
export default cloudinary;
