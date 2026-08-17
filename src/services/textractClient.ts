export async function detectTextWithTextract(imageBase64: string): Promise<string> {
  const response = await fetch('/api/textract/detect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64 }),
  })

  const data = (await response.json()) as { text?: string; error?: string }
  if (!response.ok) {
    throw new Error(data.error ?? `Textract failed (${response.status})`)
  }

  return data.text ?? ''
}
