import type { ClientConfig } from '@sanity/client';

export type Config = {
  sanityClient: SanityClientConfig,
  tailwind?: {
    cssPath?: string
  },
  preview: PreviewConfig,
}

export type SanityClientConfig = Omit<ClientConfig, 'apiVersion'>

export type PreviewConfig = {
  enabled: boolean
}