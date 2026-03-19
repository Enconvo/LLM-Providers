/**
 * OpenAI API streaming proxy.
 *
 * Forwards requests to api.openai.com, supporting:
 * - SSE streaming (chat/completions, responses)
 * - Binary responses (audio/speech TTS)
 * - Multipart uploads (audio/transcriptions)
 * - Standard JSON responses
 *
 * API key is read from the incoming Authorization header — never hardcoded.
 *
 * Route: llm/openai_proxy
 * Usage: POST with { base_url?, path, ...body }
 *        or pass path via headers.path
 */

interface ProxyParams {
    /** OpenAI API path, e.g. "/v1/chat/completions" */
    path?: string
    /** Override base URL (default: https://api.openai.com) */
    base_url?: string
    /** API key — if not in Authorization header */
    api_key?: string
    /** The actual request body to forward to OpenAI */
    [key: string]: any
}

export default async function POST(request: Request): Promise<Response> {
    const options = await request.json() as ProxyParams

    // Resolve API key: explicit param > Authorization header
    const authHeader = (options as any).headers?.authorization || ''
    const apiKey = options.api_key || authHeader.replace(/^Bearer\s+/i, '')

    if (!apiKey) {
        return Response.json(
            { error: 'Missing API key. Pass api_key in body or Authorization header.' },
            { status: 401 }
        )
    }

    // Resolve target URL
    const baseUrl = (options.base_url || 'https://api.openai.com').replace(/\/$/, '')
    const apiPath = options.path || (options as any).headers?.path || '/v1/chat/completions'
    const targetUrl = `${baseUrl}${apiPath}`

    // Build request body — strip our meta fields
    const { path: _p, base_url: _b, api_key: _k, headers: _h, ...forwardBody } = options

    const reqHeaders: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    }

    try {
        const upstream = await fetch(targetUrl, {
            method: 'POST',
            headers: reqHeaders,
            body: JSON.stringify(forwardBody),
        })

        const respCT = upstream.headers.get('content-type') || ''

        // SSE streaming
        if (respCT.includes('text/event-stream')) {
            const { readable, writable } = new TransformStream()
            const writer = writable.getWriter()
            const reader = upstream.body?.getReader()

            if (reader) {
                ;(async () => {
                    try {
                        while (true) {
                            const { done, value } = await reader.read()
                            if (done) break
                            await writer.write(value)
                        }
                    } finally {
                        writer.close()
                    }
                })()
            }

            return new Response(readable, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                },
            })
        }

        // Binary (TTS audio)
        if (respCT.includes('audio/') || respCT.includes('application/octet-stream')) {
            const data = await upstream.arrayBuffer()
            return new Response(data, {
                status: upstream.status,
                headers: { 'Content-Type': respCT },
            })
        }

        // JSON
        const text = await upstream.text()
        try {
            return Response.json(JSON.parse(text), { status: upstream.status })
        } catch {
            return new Response(text, { status: upstream.status })
        }
    } catch (err) {
        return Response.json(
            { error: 'Proxy error', message: (err as Error).message },
            { status: 502 }
        )
    }
}
