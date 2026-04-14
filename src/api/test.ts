import { NativeAPI } from '@enconvo/api';

/**
 * @param req 
 * @private
 * @returns 
 */
export default async function main(req: Request) {

    // const authProvider = await CredentialsProvider.create("anthropic");
    // let oauthCredentials = await authProvider.load();

    // console.log("loaded anthropic credentials", authProvider);

    const controller = new AbortController()

    setTimeout(() => {
        console.log('aborted')
        controller.abort()
    }, 2000);

    const resp = await NativeAPI.localApi('agent/main', {
        input_text: "hello who are you ?"
    }, {
        signal: controller.signal
    })




    console.log('resp', await resp.json())
    // const command = await CommandManageUtils.getCommandInfo('agent|SYwM4lYNlGqCsXl3lBUU', { loadPreferences: true })
    // console.log('command', command)
    // const llm = await LLMProvider.fromEnv()
    // console.log('llm', llm.getOptions())



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

