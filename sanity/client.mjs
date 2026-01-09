import { createClient } from '@sanity/client';

export function createSanityClient({projectId, dataset, token, apiVersion, perspective}) {
  return createClient({
    projectId,
    dataset,
    token,
    apiVersion,
    perspective,
    useCdn: false,
    maxRetries: 5,
    retryDelay: () => 100,
  });
}