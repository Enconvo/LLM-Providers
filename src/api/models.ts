import { LLMProvider } from '@enconvo/api';

export default async function main(req: Request) {

    // const authProvider = await CredentialsProvider.create("anthropic");
    // let oauthCredentials = await authProvider.load();

    // console.log("loaded anthropic credentials", authProvider);


    const llm = await LLMProvider.create("enconvo_ai", {
        modelName: "mistral/mistral-small-latest",
        temperature: 0,
    });

    console.log('llm', llm.getOptions())



    // console.log("loaded anthropic credentials", oauthCredentials, authProvider);
    // let providerOptions = await CommandManageUtils.getProviderOptions("image_create", true)
    // const imageGenerateProvider: ImageCreateProvider = ServiceProvider.load(providerOptions)

    // let json = ``

    // json = jsonrepair.jsonrepair(json)
    // const providerOptions = JSON.parse(json)
    // console.log("config1", providerOptions)

    return {
    }
}

