import type { Context } from '@netlify/functions'
// @ts-ignore - Importing Eleventy which might lack types
import Eleventy from '@11ty/eleventy'

interface ElevResult {
  inputPath: string;
  content: string;
}

export type PreviewParams = {
  request: Request;
  context: Context;
}

export const preview = async (props: PreviewParams) => {
  if (props.request.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  const { locale, documentType, documentId } = props.context.params

  const url = new URL(props.request.url)
  const perspective = url.searchParams.get('sanity-preview-perspective')

  process.env.IS_PREVIEW = 'true'
  process.env.PREVIEW_TYPE = documentType
  process.env.PREVIEW_ID = documentId
  process.env.PREVIEW_LOCALE = locale
  process.env.PREVIEW_PERSPECTIVE = perspective || 'drafts'

  let result = 'Nothing here'
  try {
    const elev = new Eleventy('src', undefined, {
      configPath: 'eleventy.config.mts',
      quietMode: true
    })

    const results = (await elev.toJSON()) as unknown as ElevResult[]
    await elev.destroy?.()

    if (!results[0]) {
      throw new Error(`No preview result for ${documentType} ${documentId}`)
    }

    result = results[0].content
  } catch (error) {
    console.error(error)
    if (error instanceof Error) {
      result = error.message
    }
  }

  return new Response(result, {
    headers: {
      'content-type': 'text/html',
      'cache-control': 'no-store',
    }
  })
}
