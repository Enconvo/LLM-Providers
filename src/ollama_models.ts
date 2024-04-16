import { environment } from "@enconvo/api";
import fs from 'fs'



async function fetch_model(options: any) {

    const baseUrl = options.llm.baseUrl || "http://127.0.0.1:11434";

    let models = []
    try {
        const resp = await fetch(`${baseUrl}/api/tags`)
        const json = await resp.json()
        models = json.models.map((item: any) => {
            return {
                "title": item.name,
                "value": item.name,
                "visionEnable": item.name.includes('llava'),
            }
        })
    } catch (err) {
        console.log(err)
    }

    return models
}

export default async function main(req: Request) {
    const { options } = await req.json()
    const { text } = options

    const modelCacheDir = environment.cachePath + `/models`
    if (!fs.existsSync(modelCacheDir)) {
        fs.mkdirSync(modelCacheDir, { recursive: true })
    }
    const modelCachePath = `${modelCacheDir}/${environment.commandName}.json`

    console.log('text', text)

    fs.existsSync(modelCachePath) || fs.writeFileSync(modelCachePath, '[]')
    const modelContent = fs.readFileSync(modelCachePath, 'utf8')
    let models = JSON.parse(modelContent)

    try {
        if (text === 'refresh' || models.length === 0) {
            models = await fetch_model(options)
            fs.writeFileSync(modelCachePath, JSON.stringify(models))
        }
    } catch (err) {
        console.log(err)
    }

    return JSON.stringify(models)
}



