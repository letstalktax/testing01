'use client';

import type { Attachment, Message } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, generateUUID } from '@/lib/utils';
import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import { VisibilityType } from './visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { toast } from 'sonner';
import { ReportIQUpload } from './report-iq-upload';

export function Chat({
  id,
  initialMessages,
  selectedChatModel,
  selectedVisibilityType,
  isReadonly,
}: {
  id: string;
  initialMessages: Array<Message>;
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { mutate } = useSWRConfig();
  const [documentProcessed, setDocumentProcessed] = useState(false);
  const [tempDocumentUploaded, setTempDocumentUploaded] = useState(false);

  // Clear temporary embeddings when starting a new chat session
  useEffect(() => {
    // Only clear embeddings for new chats (no initial messages)
    if (initialMessages.length === 0) {
      const clearTemporaryEmbeddings = async () => {
        try {
          // Call the DELETE endpoint to clear all temporary embeddings
          const response = await fetch('/api/temp-documents', {
            method: 'DELETE',
          });
          
          if (response.ok) {
            console.log('Temporary embeddings cleared for new chat session');
          } else {
            console.warn('Failed to clear temporary embeddings:', await response.text());
          }
        } catch (error) {
          console.error('Error clearing temporary embeddings:', error);
        }
      };
      
      clearTemporaryEmbeddings();
    }
  }, [initialMessages.length]);

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append: originalAppend,
    isLoading,
    stop,
    reload,
  } = useChat({
    id,
    body: { id, selectedChatModel: selectedChatModel },
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateUUID,
    onFinish: () => {
      mutate('/api/history');
    },
    onError: () => {
      toast.error('An error occured, please try again!');
    },
  });

  const { data: votes = [] } = useSWR<Array<Vote>>(
    `/api/vote?chatId=${id}`,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  // Wrap append to add metadata for Report IQ
  const append = useCallback(
    async (message: any, options?: any) => {
      // Add isReportIQ metadata to user messages in Report IQ mode
      if (selectedChatModel === 'chat-model-report-iq' && message.role === 'user' && documentProcessed) {
        // Create a proper copy of the message to avoid reference issues
        const messageWithMetadata = {
          ...message,
          // Ensure metadata is properly structured as a string in content
          // This avoids issues with the API expecting specific message formats
          content: message.content
        };
        
        // Store the isReportIQ flag in a way that won't interfere with the API
        // but can still be accessed by the UI components
        (messageWithMetadata as any).metadata = {
          isReportIQ: true
        };
        
        return originalAppend(messageWithMetadata, options);
      }
      return originalAppend(message, options);
    },
    [originalAppend, selectedChatModel, documentProcessed]
  );

  // Check if document has been processed based on system messages
  useEffect(() => {
    if (selectedChatModel === 'chat-model-report-iq') {
      const hasProcessedMessage = messages.some(
        (message) => 
          message.role === 'system' && 
          message.content.includes('Document has been processed')
      );
      
      if (hasProcessedMessage && !documentProcessed) {
        setDocumentProcessed(true);
        
        // Instead of adding a message here, we'll just set a flag
        // This avoids potential race conditions with the API
      }
    } else {
      setDocumentProcessed(false);
    }
  }, [messages, selectedChatModel, documentProcessed]);

  // For MusTax AI Chat, always show the chat interface
  // For MusTax AI Report IQ, only show the chat interface if a document has been processed
  const showChatInterface = selectedChatModel === 'chat-model-chat' || documentProcessed;
  
  // Show document upload for MusTax AI Report IQ when no document has been processed
  const showDocumentUpload = selectedChatModel === 'chat-model-report-iq' && !documentProcessed;

  const handleDocumentProcessed = () => {
    setDocumentProcessed(true);
    
    // No need to add messages here anymore as they're added by the ReportIQUpload component
    // This makes the transition instant
    
    // Just reload to ensure the UI updates properly
    reload();
  };
  
  const handleTempDocumentUploadComplete = (success: boolean) => {
    if (success) {
      setTempDocumentUploaded(true);
      toast.success('Document uploaded and processed for temporary context');
    }
  };

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-black relative">
        <ChatHeader
          chatId={id}
          selectedModelId={selectedChatModel}
          selectedVisibilityType={selectedVisibilityType}
          isReadonly={isReadonly}
          className="chat-header"
        />

        {showDocumentUpload && (
          <ReportIQUpload 
            onDocumentProcessed={handleDocumentProcessed} 
            chatId={id} 
          />
        )}

        {showChatInterface && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <Messages
              chatId={id}
              isLoading={isLoading}
              votes={votes}
              messages={messages}
              setMessages={setMessages}
              reload={reload}
              isReadonly={isReadonly}
              isArtifactVisible={isArtifactVisible}
            />

            <div className="flex mx-auto px-4 bg-black pb-8 md:pb-8 gap-2 w-full md:max-w-4xl border-t border-zinc-800 pt-4">
              {!isReadonly && (
                <MultimodalInput
                  chatId={id}
                  input={input}
                  setInput={setInput}
                  handleSubmit={handleSubmit}
                  isLoading={isLoading}
                  stop={stop}
                  attachments={attachments}
                  setAttachments={setAttachments}
                  messages={messages}
                  setMessages={setMessages}
                  append={append}
                  showAttachmentsButton={selectedChatModel !== 'chat-model-report-iq'}
                  onDocumentProcessed={handleTempDocumentUploadComplete}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        append={append}
        messages={messages}
        setMessages={setMessages}
        reload={reload}
        votes={votes}
        isReadonly={isReadonly}
      />
    </>
  );
}
