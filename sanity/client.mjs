import { createClient } from '@sanity/client';

export function createSanityClient(apiVersion) {
  return createClient({
    projectId: process.env.SANITY_STUDIO_PROJECT,
    // required only if perspective is not published (preview server function)
    token: process.env.SANITY_TOKEN,
    dataset: process.env.SANITY_STUDIO_DATASET,
    apiVersion,
    useCdn: false,
    perspective: process.env.IS_PREVIEW ? 'published' : (process.env.PREVIEW_PERSPECTIVE || 'drafts'),
    maxRetries: 5,
    retryDelay: (attempt) => 100,
  });
}