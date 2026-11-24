import { createClient } from '@sanity/client'
import { sanityApiVersion } from '../config/constants'

function getClient() {
  return createClient({
    projectId: process.env.SANITY_PROJECT_ID!,
    dataset: process.env.SANITY_DATASET!,
    token: process.env.SANITY_TOKEN!,
    apiVersion: sanityApiVersion,
    useCdn: false,
  })
}

/**
 * Tracks Sanity document IDs created during tests for cleanup.
 */
export class TestCleanup {
  private orderMetaIds: string[] = []
  private initialInvoiceNumber: number | null = null

  async saveInvoiceCounter(): Promise<void> {
    const client = getClient()
    const settings = await client.fetch<{ lastInvoiceNumber: number } | null>(
      `*[_type == "shopSettings"][0]{ lastInvoiceNumber }`,
    )
    this.initialInvoiceNumber = settings?.lastInvoiceNumber ?? null
  }

  trackOrderMeta(id: string): void {
    this.orderMetaIds.push(id)
  }

  async cleanup(): Promise<void> {
    const client = getClient()

    // Delete orders created from tracked orderMetas
    if (this.orderMetaIds.length > 0) {
      const orders = await client.fetch<string[]>(
        `*[_type == "order" && paymentIntentId in *[_type == "orderMeta" && _id in $ids].paymentIntentId]._id`,
        { ids: this.orderMetaIds },
      )
      for (const id of orders) {
        await client.delete(id)
      }

      // Delete orderMeta documents
      for (const id of this.orderMetaIds) {
        await client.delete(id)
      }
    }

    // Reset invoice counter
    if (this.initialInvoiceNumber !== null) {
      const settings = await client.fetch<{ _id: string } | null>(
        `*[_type == "shopSettings"][0]{ _id }`,
      )
      if (settings) {
        await client.patch(settings._id).set({ lastInvoiceNumber: this.initialInvoiceNumber }).commit()
      }
    }
  }
}
