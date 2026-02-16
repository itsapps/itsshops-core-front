import type { ClientConfig } from '@sanity/client';

export type Config = {
  sanityClient: SanityClientConfig,
  tailwind?: {
    cssPath?: string
  }
}

export type SanityClientConfig = Omit<ClientConfig, 'apiVersion'>