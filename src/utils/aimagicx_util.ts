import { BaseChatMessage, BaseChatMessageLike, LLMTool } from "@enconvo/api";

export namespace AimagicxUtil {
    /**
     * Converts Enconvo messages to OpenAI-compatible message format
     */
    export function convertMessagesToOpenAIMessages(messages: BaseChatMessage[]): any[] {
        return messages.map(message => {
            const role = message.role === 'ai' ? 'assistant' : message.role;
            
            return {
                role: role,
                content: message.content
            };
        });
    }

    /**
     * Converts Enconvo tools to OpenAI-compatible tools format
     */
    export function convertToolsToOpenAITools(tools?: LLMTool[]): any[] | undefined {
        if (!tools || tools.length === 0) {
            return undefined;
        }

        return tools.map(tool => ({
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
            }
        }));
    }

    /**
     * Validates API key format for Aimagicx
     */
    export function validateApiKey(apiKey: string): boolean {
        if (!apiKey) {
            return false;
        }
        
        // Check if it starts with mgx-sk- pattern based on documentation
        return apiKey.startsWith('mgx-sk-') || apiKey.length > 10;
    }

    /**
     * Formats error messages from Aimagicx API
     */
    export function formatApiError(error: any): string {
        if (typeof error === 'string') {
            return error;
        }
        
        if (error?.message) {
            return error.message;
        }
        
        if (error?.error?.message) {
            return error.error.message;
        }
        
        return 'Unknown error occurred';
    }

    /**
     * Gets supported model types based on Aimagicx capabilities
     */
    export function getSupportedModels(): string[] {
        return [
            '4o-mini',
            'gpt-4',
            'gpt-4-turbo',
            'gpt-3.5-turbo',
            'claude-3-sonnet',
            'claude-3-haiku',
            'gemini-pro'
        ];
    }
}