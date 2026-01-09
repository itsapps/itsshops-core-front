import {createImageUrlBuilder} from '@sanity/image-url'

export function createImageBuilder(client) {
  return createImageUrlBuilder(client)
}