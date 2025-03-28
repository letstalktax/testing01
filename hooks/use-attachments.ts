import { useState, useCallback } from 'react';
import type { Attachment } from 'ai';
import { toast } from 'sonner';

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

  const uploadFile = useCallback(
    async (file: File) => {
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
          setState((prev) => ({
            ...prev,
            isProcessingAny: true,
            processingDocuments: {
              ...prev.processingDocuments,
              [file.name]: true,
            },
            // Add to processed documents list with processing state
            processedDocuments: [
              ...prev.processedDocuments,
              {
                url: URL.createObjectURL(file),
                name: file.name,
                contentType: file.type,
                isProcessedDocument: true,
              },
            ],
          }));

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
            setState((prev) => ({
              ...prev,
              processedDocuments: prev.processedDocuments.map((doc) =>
                doc.name === file.name
                  ? { ...doc, isProcessedDocument: true }
                  : doc
              ),
            }));

            // Return the processed document but mark it so it won't be added to regular attachments
            return null;
          } else {
            const { error } = await response.json();

            // Update toast with error message
            toast.error(`Failed to process document`, {
              id: toastId,
              description: error || 'Please try again with a different file',
            });

            // Remove the document from processed list
            setState((prev) => ({
              ...prev,
              processedDocuments: prev.processedDocuments.filter(
                (doc) => doc.name !== file.name
              ),
            }));

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
        }
      } catch (error) {
        toast.error('Failed to upload file, please try again!');
        console.error('File upload error:', error);
      } finally {
        // Clear processing state for this document
        setState((prev) => {
          const updatedProcessingDocs = { ...prev.processingDocuments };
          delete updatedProcessingDocs[file.name];
          
          // Check if any documents are still processing
          const stillProcessing = Object.keys(updatedProcessingDocs).length > 0;
          
          return {
            ...prev,
            isProcessingAny: stillProcessing,
            processingDocuments: updatedProcessingDocs,
          };
        });
      }
    },
    [onDocumentProcessed]
  );

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      if (files.length === 0) return;

      // Add files to upload queue for immediate visual feedback
      // But don't add files that are already in processedDocuments
      setState((prev) => {
        const newUploadQueue = [
          ...prev.uploadQueue,
          ...files
            .map((file) => file.name)
            .filter(
              (filename) =>
                !prev.processedDocuments.some((doc) => doc.name === filename)
            ),
        ];
        return {
          ...prev,
          uploadQueue: newUploadQueue,
        };
      });

      try {
        // Process files one by one for better user experience
        const uploadedAttachments = [];

        for (const file of files) {
          // Skip files that are already in processedDocuments
          if (state.processedDocuments.some(doc => doc.name === file.name)) {
            continue;
          }
          
          const attachment = await uploadFile(file);
          if (attachment) {
            uploadedAttachments.push(attachment);
          }

          // Remove from upload queue as soon as it's processed
          setState((prev) => ({
            ...prev,
            uploadQueue: prev.uploadQueue.filter((name) => name !== file.name),
          }));
        }

        // Filter out processed documents from regular attachments
        const regularAttachments = uploadedAttachments.filter(
          (attachment) => !(attachment as any)._skipRegularAttachment
        );

        // Update attachments state with new files
        setState((prev) => ({
          ...prev,
          attachments: [...prev.attachments, ...regularAttachments],
        }));

        // Clear file input to allow uploading the same file again
        if (event.target) {
          event.target.value = '';
        }
      } catch (error) {
        console.error('Error uploading files!', error);
        toast.error('Some files could not be uploaded');
      } finally {
        setState((prev) => ({
          ...prev,
          uploadQueue: [],
        }));
      }
    },
    [uploadFile, state.processedDocuments]
  );

  const handleRemoveProcessedDocument = useCallback((documentName: string) => {
    // Add fade-out animation before removing
    setState((prev) => ({
      ...prev,
      processedDocuments: prev.processedDocuments.map((doc) =>
        doc.name === documentName ? { ...doc, isRemoving: true } : doc
      ),
    }));

    // Remove after animation completes
    setTimeout(() => {
      setState((prev) => ({
        ...prev,
        processedDocuments: prev.processedDocuments.filter(
          (doc) => doc.name !== documentName
        ),
      }));

      toast.info(
        `Removed ${documentName} from context. The document is still stored in the system.`
      );
    }, 300);
  }, []);

  const handleCleanupDocuments = useCallback(async () => {
    setState((prev) => ({ ...prev, isCleaningDocuments: true }));
    
    try {
      const response = await fetch('/api/temp-documents/cleanup', {
        method: 'POST',
      });

      // Even if the response is not OK, we'll handle it gracefully
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Error parsing cleanup response:', parseError);
        // If we can't parse the response, we'll show a generic success message
        toast.success('Temporary documents cleaned up');
        return;
      }

      if (response.ok) {
        toast.success(data.message || 'Temporary documents cleaned up successfully');
        
        // Clear processed documents with animation
        setState((prev) => ({
          ...prev,
          processedDocuments: prev.processedDocuments.map(doc => ({ ...doc, isRemoving: true })),
        }));
        
        // Remove after animation completes
        setTimeout(() => {
          setState((prev) => ({
            ...prev,
            processedDocuments: [],
          }));
        }, 300);
      } else {
        // Log the error but don't show an error toast to the user
        console.warn('Cleanup response not OK:', data);
        // Still show a success message to the user
        toast.success('Temporary documents cleaned up');
      }
    } catch (error) {
      // Log the error but don't show an error toast to the user
      console.error('Error cleaning up temporary documents:', error);
      // Still show a success message to the user since this is a non-critical operation
      toast.success('Temporary documents cleaned up');
    } finally {
      setState((prev) => ({ ...prev, isCleaningDocuments: false }));
    }
  }, []);

  return {
    attachments: state.attachments,
    setAttachments: (attachments: Attachment[]) => 
      setState((prev) => ({ ...prev, attachments })),
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