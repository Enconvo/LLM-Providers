


async function fetch_model(options: any) {

    const baseUrl = options.baseUrl || "http://127.0.0.1:11434";
    console.log('baseUrl', baseUrl,options)

    let models = []
    try {
        const resp = await fetch(`${baseUrl}/api/tags`)
        const json = await resp.json()
        models = json.models.map((item: any) => {
            return {
                "title": item.name,
                "value": item.name,
                "visionEnable": item.name.includes('llava') || item.name.includes('vision')
            }
        })
    } catch (err) {
        console.log(err)
    }

    return models
}

export default async function main(req: Request) {
    const { options } = await req.json()

    let models = []

    try {
        models = await fetch_model(options)
    } catch (err) {
        console.log(err)
    }

    return JSON.stringify(models)
}



