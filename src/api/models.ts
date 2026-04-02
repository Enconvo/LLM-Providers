import { CommandManageUtils, ExtensionManageUtils, ImageCreateProvider, LLMProvider, ServiceProvider } from "@enconvo/api"

export default async function main(req: Request) {

    let providerOptions = await CommandManageUtils.getProviderOptions("image_create", true)
    // const imageGenerateProvider: ImageCreateProvider = ServiceProvider.load(providerOptions)

    console.log("config1", providerOptions)

    return {
        providerOptions
    }
}

