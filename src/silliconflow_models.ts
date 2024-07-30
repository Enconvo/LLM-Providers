import { environment } from "@enconvo/api"
import fs from 'fs'

async function fetch_model(openAIApiKey: string) {
    // const resp = await fetch('https://api.siliconflow.cn/v1/models', {
    //     headers: {
    //         "Authorization": `Bearer ${openAIApiKey}`
    //     }
    // })
    // const result = await resp.json()


    // console.log(openAIApiKey, result)
    // const items: {
    //     id: string,
    // }[] = result.data
    const items = [
        {
            "id": "stabilityai/stable-diffusion-xl-base-1.0",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "TencentARC/PhotoMaker",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "InstantX/InstantID",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "mistralai/Mixtral-8x7B-Instruct-v0.1",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "mistralai/Mistral-7B-Instruct-v0.2",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "stabilityai/stable-diffusion-2-1",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "stabilityai/sd-turbo",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "stabilityai/sdxl-turbo",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "ByteDance/SDXL-Lightning",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "deepseek-ai/deepseek-llm-67b-chat",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "Qwen/Qwen1.5-14B-Chat",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "meta-llama/Meta-Llama-3-70B-Instruct",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "meta-llama/Meta-Llama-3-8B-Instruct",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "Qwen/Qwen1.5-7B-Chat",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "Qwen/Qwen1.5-110B-Chat",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "Qwen/Qwen1.5-32B-Chat",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "01-ai/Yi-1.5-6B-Chat",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "01-ai/Yi-1.5-9B-Chat-16K",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "01-ai/Yi-1.5-34B-Chat-16K",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "THUDM/chatglm3-6b",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "deepseek-ai/DeepSeek-V2-Chat",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "THUDM/glm-4-9b-chat",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "Qwen/Qwen2-72B-Instruct",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "Qwen/Qwen2-7B-Instruct",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "Qwen/Qwen2-57B-A14B-Instruct",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "stabilityai/stable-diffusion-3-medium",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "deepseek-ai/DeepSeek-Coder-V2-Instruct",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "Qwen/Qwen2-1.5B-Instruct",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "google/gemma-2-9b-it",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "google/gemma-2-27b-it",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "internlm/internlm2_5-7b-chat",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "BAAI/bge-large-en-v1.5",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "BAAI/bge-large-zh-v1.5",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "Pro/Qwen/Qwen2-7B-Instruct",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "Pro/Qwen/Qwen2-1.5B-Instruct",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "Pro/Qwen/Qwen1.5-7B-Chat",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "Pro/THUDM/glm-4-9b-chat",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "Pro/THUDM/chatglm3-6b",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "Pro/01-ai/Yi-1.5-9B-Chat-16K",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "Pro/01-ai/Yi-1.5-6B-Chat",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "Pro/google/gemma-2-9b-it",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "Pro/internlm/internlm2_5-7b-chat",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "Pro/meta-llama/Meta-Llama-3-8B-Instruct",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "Pro/mistralai/Mistral-7B-Instruct-v0.2",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "meta-llama/Meta-Llama-3.1-8B-Instruct",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "Pro/meta-llama/Meta-Llama-3.1-8B-Instruct",
            "object": "model",
            "created": 0,
            "owned_by": ""
        },
        {
            "id": "meta-llama/Meta-Llama-3.1-70B-Instruct",
            "object": "model",
            "created": 0,
            "owned_by": ""
        }
    ]

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
    console.log(options)
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


