'use client';

import type {
  Attachment,
  ChatRequestOptions,
  CreateMessage,
  Message,
} from 'ai';
import cx from 'classnames';
import type React from 'react';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';

import { sanitizeUIMessages } from '@/lib/utils';

import { ArrowUpIcon, PaperclipIcon, StopIcon, TrashIcon } from './icons';
import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { SuggestedActions } from './suggested-actions';
import equal from 'fast-deep-equal';
import { useAttachments } from '@/hooks/use-attachments';

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  isLoading,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  append,
  handleSubmit,
  className,
  onDocumentProcessed,
  showAttachmentsButton = true,
}: {
  chatId: string;
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<Message>;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  handleSubmit: (
    event?: {
      preventDefault?: () => void;
    },
    chatRequestOptions?: ChatRequestOptions,
  ) => void;
  className?: string;
  onDocumentProcessed?: (success: boolean) => void;
  showAttachmentsButton?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousAttachmentsRef = useRef<Attachment[]>(attachments);
  const previousManagedAttachmentsRef = useRef<Attachment[]>([]);

  // Use our custom hook for attachment management
  const {
    attachments: managedAttachments,
    setAttachments: setManagedAttachments,
    processedDocuments,
    uploadQueue,
    processingDocuments,
    isProcessingAny,
    isCleaningDocuments,
    handleFileChange,
    handleRemoveProcessedDocument,
    handleCleanupDocuments,
  } = useAttachments({
    onDocumentProcessed,
  });

  // Sync parent attachments to managed attachments, but only when they've changed
  useEffect(() => {
    if (!equal(attachments, previousAttachmentsRef.current)) {
      previousAttachmentsRef.current = attachments;
      if (!equal(attachments, managedAttachments)) {
        setManagedAttachments(attachments);
      }
    }
  }, [attachments, managedAttachments, setManagedAttachments]);

  // Sync managed attachments to parent attachments, but only when they've changed
  useEffect(() => {
    if (!equal(managedAttachments, previousManagedAttachmentsRef.current)) {
      previousManagedAttachmentsRef.current = managedAttachments;
      if (!equal(managedAttachments, attachments)) {
        setAttachments(managedAttachments);
      }
    }
  }, [managedAttachments, attachments, setAttachments]);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const resetHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  useEffect(() => {
    adjustHeight();
    return () => {
      resetHeight();
    };
  }, [input]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setInput(value);
  };

  const submitForm = () => {
    if (input.trim() || attachments.length > 0) {
      handleSubmit(undefined, {
        experimental_attachments: attachments,
      });
      resetHeight();
      
      // Focus the textarea after submission if not on mobile
      if (typeof window !== 'undefined' && window.innerWidth > 768) {
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 100);
      }
    }
  };

  return (
    <div className="relative w-full flex flex-col gap-4 pt-4">
      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 &&
        processedDocuments.length === 0 && (
          <SuggestedActions append={append} chatId={chatId} />
        )}

      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
        accept=".jpeg,.jpg,.png,.pdf,.xls,.xlsx,.txt,.md,.docx,image/jpeg,image/png,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      />

      {(attachments.length > 0 || uploadQueue.length > 0 || processedDocuments.length > 0) && (
        <div
          data-testid="attachments-preview"
          className="flex flex-row gap-2 overflow-x-auto items-end py-2 px-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent"
        >
          {/* Regular attachments - filter out any that are also in processedDocuments */}
          {attachments
            .filter(attachment => 
              !processedDocuments.some(doc => doc.name === attachment.name)
            )
            .map((attachment) => (
              <div key={attachment.url} className="animate-scale-in">
                <PreviewAttachment 
                  attachment={attachment} 
                />
              </div>
            ))}

          {/* Processed documents */}
          {processedDocuments.map((doc) => (
            <div 
              key={`processed-${doc.name}`} 
              className={`transition-all duration-300 ${doc.isRemoving ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
            >
              <PreviewAttachment
                attachment={doc}
                isProcessing={doc.name ? processingDocuments[doc.name] : false}
                onRemove={() => doc.name && handleRemoveProcessedDocument(doc.name)}
              />
            </div>
          ))}

          {/* Files in upload queue - filter out any that are already in processedDocuments */}
          {uploadQueue
            .filter(filename => 
              !processedDocuments.some(doc => doc.name === filename)
            )
            .map((filename) => (
              <div key={filename} className="animate-scale-in">
                <PreviewAttachment
                  attachment={{
                    url: '',
                    name: filename,
                    contentType: filename.endsWith('.pdf') ? 'application/pdf' : '',
                  }}
                  isUploading={true}
                />
              </div>
            ))}
        </div>
      )}

      <Textarea
        data-testid="multimodal-input"
        ref={textareaRef}
        placeholder="Send a message..."
        value={input}
        onChange={handleInput}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            input.trim().length > 0
          ) {
            event.preventDefault();
            submitForm();
          }
        }}
        disabled={isLoading}
        className="chat-input resize-none text-base py-4 px-5 max-h-[15rem] min-h-[60px] border rounded-2xl focus-visible:ring-1 focus-visible:ring-offset-0 w-full pr-24"
        style={{
          filter: input === '' && !isLoading ? 'blur(0px)' : undefined,
        }}
        rows={2}
      />

      <div className="absolute bottom-[18px] right-5 flex items-center gap-3 justify-end">
        {showAttachmentsButton && !isLoading && (
          <AttachmentsButton
            fileInputRef={fileInputRef}
            isLoading={isLoading}
            processingDocument={isProcessingAny}
          />
        )}

        {isLoading || managedAttachments.length > 0 ? (
          <StopButton stop={stop} setMessages={setMessages} />
        ) : (
          <SendButton
            submitForm={submitForm}
            input={input}
            uploadQueue={uploadQueue}
          />
        )}
      </div>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    return true;
  },
);

function PureAttachmentsButton({
  fileInputRef,
  isLoading,
  processingDocument,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  isLoading: boolean;
  processingDocument?: boolean;
}) {
  return (
    <Button
      data-testid="attachments-button"
      className={`rounded-md rounded-bl-lg p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200 transition-all duration-300 ${
        processingDocument ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      disabled={isLoading || processingDocument}
      variant="ghost"
      title="Attach files"
    >
      {processingDocument ? (
        <span className="animate-pulse text-blue-500 dark:text-blue-400">
          <PaperclipIcon size={14} />
        </span>
      ) : (
        <PaperclipIcon size={14} />
      )}
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
}) {
  return (
    <Button
      data-testid="stop-button"
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => sanitizeUIMessages(messages));
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  submitForm,
  input,
  uploadQueue,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
}) {
  return (
    <Button
      data-testid="send-button"
      onClick={submitForm}
      size="icon"
      variant="ghost"
      disabled={!input.trim() && uploadQueue.length === 0}
      className="chat-send-button h-9 w-9 rounded-full flex items-center justify-center"
    >
      <ArrowUpIcon size={18} />
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  return true;
});
