import { LLMProvider } from "@enconvo/api"

/**
 * Preload the configured LLM provider on app startup.
 * @private
 */
export default async function main() {
    LLMProvider.fromEnv().then((provider) => {
        provider.preload()
    })
}
