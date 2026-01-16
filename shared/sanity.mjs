import { createClient } from '@sanity/client';
import { createImageUrlBuilder } from '@sanity/image-url'

export function createSanityClient({projectId, dataset, token, apiVersion, perspective, useCdn=false, maxRetries=5, retryDelay=() => 100}) {
  return createClient({
    projectId,
    dataset,
    token,
    apiVersion,
    perspective,
    useCdn,
    maxRetries,
    retryDelay,
  });
}

export function createImageBuilder(client) {
  return createImageUrlBuilder(client)
}