import {
  TextractClient,
  DetectDocumentTextCommand,
  type Block,
} from '@aws-sdk/client-textract'
import { getAwsRegion } from './awsSecrets'
import type { TextractDetectRequest } from '../src/types/textract'

export async function detectDocumentText(
  request: TextractDetectRequest
): Promise<string> {
  const bytes = Buffer.from(stripDataUrl(request.imageBase64), 'base64')

  if (bytes.length === 0) {
    throw new Error('OCR image was empty.')
  }
  if (bytes.length > 5 * 1024 * 1024) {
    throw new Error('OCR image is too large for Textract (5 MB limit).')
  }

  const client = new TextractClient({ region: getAwsRegion() })
  const response = await client.send(
    new DetectDocumentTextCommand({
      Document: { Bytes: bytes },
    })
  )

  return blocksToText(response.Blocks ?? [])
}

function stripDataUrl(value: string): string {
  const comma = value.indexOf(',')
  if (value.startsWith('data:') && comma !== -1) {
    return value.slice(comma + 1)
  }
  return value
}

function blocksToText(blocks: Block[]): string {
  const lines = blocks
    .filter((block) => block.BlockType === 'LINE' && block.Text)
    .sort((a, b) => {
      const aTop = a.Geometry?.BoundingBox?.Top ?? 0
      const bTop = b.Geometry?.BoundingBox?.Top ?? 0
      if (Math.abs(aTop - bTop) > 0.01) return aTop - bTop
      const aLeft = a.Geometry?.BoundingBox?.Left ?? 0
      const bLeft = b.Geometry?.BoundingBox?.Left ?? 0
      return aLeft - bLeft
    })
    .map((block) => block.Text!.trim())
    .filter(Boolean)

  return lines.join('\n')
}
