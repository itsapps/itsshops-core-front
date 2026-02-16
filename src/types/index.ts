import type { ClientConfig } from '@sanity/client';

export type Config = {
  sanityClient: SanityClientConfig
}

export type SanityClientConfig = Omit<ClientConfig, 'apiVersion'>