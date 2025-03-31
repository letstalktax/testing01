import { useState, useCallback, useRef } from 'react';
import type { Attachment } from 'ai';
import { toast } from 'sonner';
import equal from 'fast-deep-equal';

type ProcessedDocument = Attachment & {
  isProcessedDocument: boolean;
  isRemoving?: boolean;
};

type AttachmentState = {
  attachments: Attachment[];
  processedDocuments: ProcessedDocument[];
  uploadQueue: string[];
  processingDocuments: Record<string, boolean>;
  isProcessingAny: boolean;
  isCleaningDocuments?: boolean;
};

export function useAttachments({
  onDocumentProcessed,
}: {
  onDocumentProcessed?: (success: boolean) => void;
}) {
  const [state, setState] = useState<AttachmentState>({
    attachments: [],
    processedDocuments: [],
    uploadQueue: [],
    processingDocuments: {},
    isProcessingAny: false,
  });

  // Use a ref to track if we're currently processing a file
  const isProcessingRef = useRef(false);
  // Use refs to avoid toast callbacks from causing rerenders
  const stateRef = useRef(state);
  stateRef.current = state;

  const updateState = useCallback((newState: Partial<AttachmentState>) => {
    setState(prev => {
      const updated = { ...prev, ...newState };
      return equal(prev, updated) ? prev : updated;
    });
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      if (isProcessingRef.current) return null;
      isProcessingRef.current = true;

      const formData = new FormData();
      formData.append('file', file);

      try {
        // Check if this is a document type that should be processed for RAG
        const isDocumentForRAG =
          file.type === 'application/pdf' ||
          file.type === 'text/plain' ||
          file.type === 'text/markdown' ||
          file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        if (isDocumentForRAG) {
          // Set this specific document as processing
          updateState({
            isProcessingAny: true,
            processingDocuments: {
              ...stateRef.current.processingDocuments,
              [file.name]: true,
            },
            // Add to processed documents list with processing state
            processedDocuments: [
              ...stateRef.current.processedDocuments,
              {
                url: URL.createObjectURL(file),
                name: file.name,
                contentType: file.type,
                isProcessedDocument: true,
              },
            ],
          });

          // Show toast notification with more details
          const toastId = toast.loading(`Processing ${file.name}...`, {
            duration: 10000,
            description: 'This document will be available for questions after processing',
          });

          // Process document for RAG
          const response = await fetch('/api/temp-documents', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();

            // Update toast with success message
            toast.success(`Document processed successfully`, {
              id: toastId,
              description: `${data.embeddings} embeddings created for context`,
            });

            if (onDocumentProcessed) {
              onDocumentProcessed(true);
            }

            // Update the processed document in the list
            updateState({
              processedDocuments: stateRef.current.processedDocuments.map((doc) =>
                doc.name === file.name
                  ? { ...doc, isProcessedDocument: true }
                  : doc
              ),
            });

            return null;
          } else {
            const { error } = await response.json();

            // Update toast with error message
            toast.error(`Failed to process document`, {
              id: toastId,
              description: error || 'Please try again with a different file',
            });

            // Remove the document from processed list
            updateState({
              processedDocuments: stateRef.current.processedDocuments.filter(
                (doc) => doc.name !== file.name
              ),
            });

            if (onDocumentProcessed) {
              onDocumentProcessed(false);
            }
            return null;
          }
        } else {
          // Regular file upload for attachments
          const uploadToastId = toast.loading(`Uploading ${file.name}...`);

          const response = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();
            const { url, pathname, contentType } = data;

            toast.success(`File uploaded successfully`, {
              id: uploadToastId,
            });

            return {
              url,
              name: pathname,
              contentType: contentType,
            };
          }

          const { error } = await response.json();
          toast.error(error || 'Failed to upload file', {
            id: uploadToastId,
          });
          return null;
        }
      } catch (error) {
        toast.error('Failed to upload file, please try again!');
        console.error('File upload error:', error);
        return null;
      } finally {
        // Clear processing state for this document
        const updatedProcessingDocs = { ...stateRef.current.processingDocuments };
        delete updatedProcessingDocs[file.name];
        
        updateState({
          isProcessingAny: Object.keys(updatedProcessingDocs).length > 0,
          processingDocuments: updatedProcessingDocs,
        });
        
        isProcessingRef.current = false;
      }
    },
    [updateState, onDocumentProcessed]
  );

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;

      const newUploadQueue = files
        .map((file) => file.name)
        .filter((filename) => !stateRef.current.processedDocuments.some((doc) => doc.name === filename));

      updateState({ uploadQueue: [...stateRef.current.uploadQueue, ...newUploadQueue] });

      try {
        for (const file of files) {
          if (stateRef.current.processedDocuments.some(doc => doc.name === file.name)) {
            continue;
          }

          const attachment = await uploadFile(file);
          if (attachment) {
            updateState({
              attachments: [...stateRef.current.attachments, attachment],
              uploadQueue: stateRef.current.uploadQueue.filter(name => name !== file.name)
            });
          }
        }

        if (event.target) {
          event.target.value = '';
        }
      } catch (error) {
        console.error('Error uploading files!', error);
        toast.error('Some files could not be uploaded');
      } finally {
        updateState({ uploadQueue: [] });
      }
    },
    [uploadFile, updateState]
  );

  const handleRemoveProcessedDocument = useCallback((documentName: string) => {
    // Add fade-out animation before removing
    updateState({
      processedDocuments: stateRef.current.processedDocuments.map((doc) =>
        doc.name === documentName ? { ...doc, isRemoving: true } : doc
      ),
    });

    // Remove after animation completes
    setTimeout(() => {
      updateState({
        processedDocuments: stateRef.current.processedDocuments.filter(
          (doc) => doc.name !== documentName
        ),
      });

      toast.info(
        `Removed ${documentName} from context. The document is still stored in the system.`
      );
    }, 300);
  }, [updateState]);

  const handleCleanupDocuments = useCallback(async () => {
    updateState({ isCleaningDocuments: true });
    
    try {
      const response = await fetch('/api/temp-documents', {
        method: 'DELETE'
      });
      
      if (response.ok) {
        updateState({
          processedDocuments: [],
          isCleaningDocuments: false
        });
        toast.success('All temporary documents cleared');
      } else {
        throw new Error('Failed to clear documents');
      }
    } catch (error) {
      console.error('Error cleaning up documents:', error);
      toast.error('Failed to clear documents');
      updateState({ isCleaningDocuments: false });
    }
  }, [updateState]);

  return {
    attachments: state.attachments,
    setAttachments: (attachments: Attachment[]) => 
      updateState({ attachments }),
    processedDocuments: state.processedDocuments,
    uploadQueue: state.uploadQueue,
    processingDocuments: state.processingDocuments,
    isProcessingAny: state.isProcessingAny,
    isCleaningDocuments: state.isCleaningDocuments,
    handleFileChange,
    handleRemoveProcessedDocument,
    handleCleanupDocuments,
  };
} 