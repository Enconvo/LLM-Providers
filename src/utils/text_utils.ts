import { ChatMessageContent, ChatMessageContentText, ContextItem, ExtensionCommand, Skill } from "@enconvo/api";

interface MentionObject {
    commandType: ExtensionCommand.CommandType;
    icon: string;
    id: string;
    title: string;
    params?: Record<string, string | number | boolean | object>;
}



export async function handleMention(msgContent: ChatMessageContentText) {
    const mentionPattern = /\[\[(\{.*?\})\]\]/g;

    const matches = [...msgContent.text.matchAll(mentionPattern)];

    const parsedObjects: MentionObject[] = [];

    for (const match of matches) {
        try {
            const jsonString = match[1]; // 捕获组 1 是 {...} 部分
            const obj = JSON.parse(jsonString) as MentionObject;
            parsedObjects.push(obj);
        } catch (error) {
            console.error('Failed to parse JSON:', match[1], error);
        }
    }



    let processedText = msgContent.text;

    for (let i = 0; i < parsedObjects.length; i++) {
        const obj = parsedObjects[i];
        const originalMatch = matches[i][0]; // 完整的 [[{...}]] 字符串

        if (obj.commandType === 'context') {
            let contextItems: ContextItem[] | undefined = msgContent.additional?.entities?.[obj.id]?.entity as ContextItem[] | undefined
            if (contextItems) {
                const contextJson = JSON.stringify(contextItems);
                processedText = processedText.replace(originalMatch, `<inline_context>${contextJson}</inline_context>`);
            }
        } else if (obj.commandType === 'skill') {

            let skill: Skill | undefined = msgContent.additional?.entities?.[obj.id]?.entity as Skill | undefined
            if (skill) {
                processedText = processedText.replace(originalMatch, `<inline_skill>\n<base_directory_for_this_skill>${skill.skillPath}</base_directory_for_this_skill>\n<command-name>${skill.name}</command-name>\n<description>${skill.description}</description>\n<content>${skill.content}</content>\n</inline_skill>`);
            }

        } else if (obj.commandType === 'knowledge_base') {
            const kb = msgContent.additional?.entities?.[obj.id]?.entity as ChatMessageContent.Additional.KnowledgeBase | undefined
            if (kb) {
                const title = kb.title ?? obj.title ?? ''
                const description = kb.description ?? ''
                processedText = processedText.replace(originalMatch, `<inline_knowledge_base>\n<id>${kb.id}</id>\n<title>${title}</title>\n<description>${description}</description>\n</inline_knowledge_base>`);
            }
        } else if (obj.commandType === 'recordings') {
            const recording = msgContent.additional?.entities?.[obj.id]?.entity as ChatMessageContent.Additional.Recording | undefined
            if (recording) {
                const title = recording.title ?? obj.title ?? ''
                const content = recording.content ?? ''
                processedText = processedText.replace(originalMatch, `<inline_recording>\n<recording-id>${recording.attachment_id ?? ''}</recording-id>\n<title>${title}</title>\n<content>${content}</content>\n</inline_recording>`);
            }
        } else {
            processedText = processedText.replace(originalMatch, `<inline_tool description="${obj.title}" name="${obj.id}"></inline_tool>`);
        }
    }


    const newMsgContent: ChatMessageContentText = {
        ...msgContent,
        text: processedText,
    };

    return newMsgContent;
}