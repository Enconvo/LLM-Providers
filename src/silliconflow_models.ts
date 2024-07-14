import { environment } from "@enconvo/api"
import fs from 'fs'

async function fetch_model(openAIApiKey: string) {
    const resp = await fetch('https://api.siliconflow.cn/v1/models', {
        headers: {
            "Authorization": `Bearer ${openAIApiKey}`
        }
    })
    const result = await resp.json()
    const items: {
        id: string,
    }[] = result.data

    return items.filter((item) => {
        return !item.id.startsWith('stabilityai') && !item.id.startsWith('ByteDance')
    }).map((item) => {
        return {
            // 第一个字母大写
            title: item.id,
            value: item.id
        }
    })
}

export default async function main(req: Request) {
    const { options } = await req.json()
    const { text, openAIApiKey: apiKey } = options

    const modelCacheDir = environment.cachePath + `/models`
    if (!fs.existsSync(modelCacheDir)) {
        fs.mkdirSync(modelCacheDir, { recursive: true })
    }
    const modelCachePath = `${modelCacheDir}/${environment.commandName}.json`

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


