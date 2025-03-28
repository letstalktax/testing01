'use server';

import { generateText, Message } from 'ai';
import { cookies } from 'next/headers';

import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisiblityById,
} from '@/lib/db/queries';
import { VisibilityType } from '@/components/visibility-selector';
import { myProvider } from '@/lib/ai/providers';

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set('chat-model', model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: Message;
}): Promise<string> {
  try {
    const { text: title } = await generateText({
      model: myProvider.languageModel('gpt-3.5-turbo'),
      system: `Generate a concise, descriptive title (max 50 chars) for a chat based on the user's first message.
- The title should capture the main topic or intent
- Do not use quotes or special characters
- Keep it natural and readable
- Do not include "Chat about" or similar prefixes`,
      prompt: typeof message.content === 'string' 
        ? message.content 
        : JSON.stringify(message.content),
    });

    return title.length > 50 ? title.substring(0, 47) + '...' : title;
  } catch (error) {
    console.error('Error generating title:', error);
    return 'New Conversation';
  }
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const messages = await getMessageById({ id });
  
  if (!messages || messages.length === 0) {
    console.error(`Message with id ${id} not found`);
    return;
  }
  
  const message = messages[0];

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisiblityById({ chatId, visibility });
}
