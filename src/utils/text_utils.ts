import { ChatMessageContentText, MentionUtil } from "@enconvo/api";

export async function handleMention(msgContent: ChatMessageContentText): Promise<ChatMessageContentText> {
    return MentionUtil.expandMentionsInContent(msgContent);
}
