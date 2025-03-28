export const DEFAULT_CHAT_MODEL: string = 'chat-model-chat';

interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-model-chat',
    name: 'MusTax AI Chat',
    description: 'Interactive chat for UAE Corporate Tax inquiries',
  },
  {
    id: 'chat-model-report-iq',
    name: 'MusTax AI Report IQ',
    description: 'Detailed reports and insights on UAE Corporate Tax',
  },
  {
    id: 'chat-model-analyze',
    name: 'MusTax AI Analyze',
    description: 'Analyze documents with UAE Corporate Tax knowledge base',
  },
];
