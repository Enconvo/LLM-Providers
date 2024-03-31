import { environment } from "@enconvo/api"
import fs from 'fs'

async function fetch_model() {
    const resp = await fetch('https://openrouter.ai/api/v1/models')
    let json = await resp.json()
    return json['data'].map((model: any) => {
        return {
            title: model['name'],
            value: model['id']
        }
    })
}

export default async function main(req: Request) {

    const { options } = await req.json()
    const { text } = options
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
            models = await fetch_model()
            fs.writeFileSync(modelCachePath, JSON.stringify(models))
        }

    } catch (err) {
        console.log(err)
    }

    return JSON.stringify(models)
}
