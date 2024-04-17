import { environment } from "@enconvo/api"
import fs from 'fs'

async function fetch_model(apiKey: string) {
    const resp = await fetch('https://api.cohere.ai/v1/models', {
        headers: {
            "Authorization": `Bearer ${apiKey}`
        }
    })
    const result = await resp.json()
    const items: {
        name: string,
        context_length: string,
        endpoints: string[],
    }[] = result.models

    return items.filter((item) => {
        return item.endpoints.includes("chat")
    }).map((item) => {
        return {
            // 第一个字母大写
            title: `${capitalizeFirstLetter(item.name)}`,
            value: item.name,
            context: item.context_length
        }
    })
}

function capitalizeFirstLetter(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export default async function main(req: Request) {
    const { options } = await req.json()
    const { text, apiKey } = options

    const modelCacheDir = environment.cachePath + `/models`
    if (!fs.existsSync(modelCacheDir)) {
        fs.mkdirSync(modelCacheDir, { recursive: true })
    }
    const modelCachePath = `${modelCacheDir}/${environment.commandName}.json`

    console.log('text', text, modelCachePath)
    fs.existsSync(modelCachePath) || fs.writeFileSync(modelCachePath, '[]')
    const modelContent = fs.readFileSync(modelCachePath, 'utf8')
    let models = JSON.parse(modelContent)

    try {
        if (text === 'refresh' || models.length === 0) {
            models = await fetch_model(apiKey)
            fs.writeFileSync(modelCachePath, JSON.stringify(models))
        }
    } catch (err) {
        console.log(err)
    }

    return JSON.stringify(models)
}


