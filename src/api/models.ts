import * as jsonrepair from 'jsonrepair'

export default async function main(req: Request) {

    // let providerOptions = await CommandManageUtils.getProviderOptions("image_create", true)
    // const imageGenerateProvider: ImageCreateProvider = ServiceProvider.load(providerOptions)

    let json = ``

    json = jsonrepair.jsonrepair(json)
    const providerOptions = JSON.parse(json)
    console.log("config1", providerOptions)

    return {
        providerOptions
    }
}

