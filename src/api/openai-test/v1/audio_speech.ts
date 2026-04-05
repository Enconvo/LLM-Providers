import { proxyToOpenAI } from "./_proxy.ts"

export default async function POST(request: Request): Promise<Response> {
    return proxyToOpenAI(request, "/v1/audio/speech")
}
