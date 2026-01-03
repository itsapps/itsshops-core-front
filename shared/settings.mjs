// itsshops-core-front/shared/settings.mjs
import 'dotenv/config';

const environment = process.env.STAGE || 'production';

export const baseUrl = process.env.DEV_URL || process.env.URL || 'http://localhost:8080';
export const hostname = new URL(baseUrl).hostname;
export const isDevEnv = environment === 'development';
export const isPreview = process.env.IS_PREVIEW === 'true' || false;

// Sanity
export const sanityApiVersion = "v2025-05-25";
export const studioUrl = process.env.SANITY_STUDIO_URL;

// Stripe
export const stripeApiVersion = "2025-08-27.basil";
export const stripePublishableApiKey = process.env.STRIPE_PUBLISHABLE_API_KEY;

// Misc
export const supportEmail = process.env.SUPPORT_EMAIL;
export const developerName = process.env.DEVELOPER_NAME;
export const publicDeveloperName = process.env.PUBLIC_DEVELOPER_NAME;
export const publicDeveloperWebsite = process.env.PUBLIC_DEVELOPER_WEBSITE;

// Dev server / live reload
export const devServerPort = Number(process.env.DEV_SERVER_PORT || 8080);
export const devLiveReload = process.env.DEV_LIVE_RELOAD !== "false"; // default true
