import { sanityApiVersion } from '../../config/constants';
import { SanityClientConfig } from '../../types';

import { createClient } from '@sanity/client';
import type { SanityClient } from '@sanity/client';
import { createImageUrlBuilder } from '@sanity/image-url'


export function createSanityClient(config: SanityClientConfig) {
  const retryDelay = config.retryDelay ?? (() => 100);
  return createClient({
    ...config,
    apiVersion: sanityApiVersion,
    maxRetries: config.maxRetries || 5,
    retryDelay,
  });
}

export function createImageBuilder(client: SanityClient) {
  return createImageUrlBuilder(client)
}