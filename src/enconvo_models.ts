import { environment } from "@enconvo/api"
import fs from 'fs'

async function fetch_model() {
    const resp = await fetch('https://file.enconvo.com/modles/enconvo.json')
    return await resp.json()
}


export default async function main(req: Request) {
    const { options } = await req.json()
    const { text } = options

    const modelCacheDir = environment.cachePath + `/models`
    if (!fs.existsSync(modelCacheDir)) {
        fs.mkdirSync(modelCacheDir, { recursive: true })
    }
    const modelCachePath = `${modelCacheDir}/${environment.commandName}.json`
    // 如果文件超过一天就重新获取
    const modelStat = fs.statSync(modelCachePath)
    const now = new Date()
    const diff = now.getTime() - modelStat.mtime.getTime()
    if (diff > 1000 * 60 * 60 * 24) {
        fs.unlinkSync(modelCachePath)
    }

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


