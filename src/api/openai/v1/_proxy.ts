/**
 * Shared OpenAI proxy logic.
 * API key MUST be passed via headers (Authorization: Bearer sk-xxx).
 * Optional: base_url in body to proxy to OpenAI-compatible services.
 */

interface ProxyBody {
    base_url?: string
    [key: string]: any
}

export async function proxyToOpenAI(
    request: Request,
    openaiPath: string
): Promise<Response> {
    const options = await request.json() as ProxyBody

    // API key from headers only
    const authorization = options.headers?.authorization || options.headers?.Authorization || ''
    const apiKey = authorization.replace(/^Bearer\s+/i, '')

    if (!apiKey) {
        return Response.json(
            { error: 'Missing API key. Pass Authorization header with Bearer token.' },
            { status: 401 }
        )
    }

    // Target URL
    const baseUrl = (options.base_url || 'https://api.openai.com').replace(/\/$/, '')
    const targetUrl = `${baseUrl}${openaiPath}`

    // Strip meta fields, forward the rest as request body
    const { base_url: _b, headers: _h, ...forwardBody } = options

    try {
        const upstream = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
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
                headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
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
