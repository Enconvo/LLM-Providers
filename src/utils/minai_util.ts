import { BaseChatMessage, AITool } from "@enconvo/api";

export namespace MinaiUtil {
    /**
     * Converts Enconvo messages to 1min AI compatible format
     * 1min AI uses a different message structure than standard OpenAI format
     */
    export function convertMessagesToMinaiMessages(messages: BaseChatMessage[]): any[] {
        return messages.map(message => {
            const role = message.role === 'ai' ? 'assistant' : message.role;
            
            // Handle content that might be array or string
            let content = "";
            if (typeof message.content === 'string') {
                content = message.content;
            } else if (Array.isArray(message.content)) {
                // Extract text content from array format
                const textContent = message.content
                    .filter(item => typeof item === 'object' && 'text' in item)
                    .map(item => item.text)
                    .join(' ');
                content = textContent;
            }
            
            return {
                role: role,
                content: content
            };
        });
    }

    /**
     * Extracts images from messages for 1min AI image list format
     */
    export function extractImagesFromMessages(messages: BaseChatMessage[]): string[] {
        const imageList: string[] = [];
        
        for (const message of messages) {
            if (Array.isArray(message.content)) {
                for (const item of message.content) {
                    if (typeof item === 'object' && 'image_url' in item) {
                        // Extract image URL or asset key
                        const imageUrl = item.image_url.url;
                        if (imageUrl) {
                            // If it's a file:// URL, convert to asset key format
                            if (imageUrl.startsWith('file://')) {
                                // Extract filename as asset key
                                const filename = imageUrl.split('/').pop() || imageUrl;
                                imageList.push(filename);
                            } else if (imageUrl.startsWith('http')) {
                                imageList.push(imageUrl);
                            } else {
                                // Assume it's already an asset key
                                imageList.push(imageUrl);
                            }
                        }
                    }
                }
            }
        }
        
        return imageList;
    }

    /**
     * Converts tools to 1min AI format
     * Note: 1min AI has limited tool support, mainly for specific features
     */
    export function convertToolsToMinaiTools(tools?: AITool[]): any[] | undefined {
        if (!tools || tools.length === 0) {
            return undefined;
        }

        // 1min AI doesn't use standard OpenAI tools format
        // Instead, it uses specific feature types and prompt objects
        return tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }));
    }

    /**
     * Builds 1min AI specific prompt object based on feature type
     */
    export function buildPromptObject(
        prompt: string, 
        options: {
            imageList?: string[],
            webSearch?: boolean,
            numOfSite?: number,
            maxWord?: number,
            isMixed?: boolean
        } = {}
    ): any {
        return {
            prompt: prompt,
            isMixed: options.isMixed || false,
            imageList: options.imageList || [],
            webSearch: options.webSearch || false,
            numOfSite: options.numOfSite || 1,
            maxWord: options.maxWord || 500
        };
    }

    /**
     * Gets the appropriate 1min AI feature type based on content
     */
    export function getFeatureType(
        hasImages: boolean = false,
        hasDocuments: boolean = false,
        isImageGeneration: boolean = false
    ): string {
        if (isImageGeneration) {
            return "IMAGE_GENERATOR";
        }
        
        if (hasDocuments) {
            return "CHAT_WITH_PDF";
        }
        
        if (hasImages) {
            return "CHAT_WITH_IMAGE";
        }
        
        return "CHAT_WITH_AI";
    }

    /**
     * Validates API key format for 1min AI
     */
    export function validateApiKey(apiKey: string): boolean {
        if (!apiKey) {
            return false;
        }
        
        // 1min AI API keys should be present and non-empty
        return apiKey.length > 10;
    }

    /**
     * Formats error messages from 1min AI API
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
        
        if (error?.detail) {
            return error.detail;
        }
        
        return 'Unknown error occurred';
    }

    /**
     * Gets supported models for 1min AI based on documentation
     */
    export function getSupportedModels(): string[] {
        return [
            // OpenAI Models
            "o3-mini",
            "o1-preview", 
            "o1-mini",
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4-turbo",
            "gpt-3.5-turbo",
            
            // Claude Models
            "claude-3-5-haiku-20241022",
            "claude-3-5-sonnet-20240620", 
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307",
            
            // Google Models
            "gemini-1.5-flash",
            "gemini-1.5-pro",
            "gemini-1.0-pro",
            
            // Mistral Models
            "mistral-large-latest",
            "mistral-small-latest",
            "mistral-nemo",
            "pixtral-12b",
            "open-mixtral-8x22b",
            "open-mixtral-8x7b",
            "open-mistral-7b",
            
            // Meta Models
            "meta/meta-llama-3.1-405b-instruct",
            "meta/meta-llama-3-70b-instruct",
            "meta/llama-2-70b-chat",
            
            // Other Models
            "command",
            "deepseek-chat",
            "grok-2"
        ];
    }

    /**
     * Gets supported image generation models
     */
    export function getImageModels(): string[] {
        return [
            "midjourney",
            "dall-e-2",
            "stable-diffusion-xl-1024-v1-0",
            "stable-diffusion-v1-6",
            "black-forest-labs/flux-schnell",
            "stable-image",
            "clipdrop"
        ];
    }
}