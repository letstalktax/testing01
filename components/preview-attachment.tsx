import type { Attachment } from 'ai';
import { useState, useEffect } from 'react';

import { FileIcon, LoaderIcon, TableIcon, CrossIcon } from './icons';

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  isProcessing = false,
  onRemove,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  isProcessing?: boolean;
  onRemove?: () => void;
}) => {
  const { name, url, contentType } = attachment;
  const isPdf = contentType?.includes('pdf');
  
  // State to track animation transitions
  const [showProcessingIndicator, setShowProcessingIndicator] = useState(isProcessing);
  const [showRemoveButton, setShowRemoveButton] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Handle smooth transitions between states
  useEffect(() => {
    let processingTimeout: NodeJS.Timeout;
    let removeTimeout: NodeJS.Timeout;
    
    if (isProcessing) {
      setShowProcessingIndicator(true);
      setShowRemoveButton(false);
    } else if (!isUploading && isPdf) {
      // Add a small delay before showing the remove button to ensure smooth transition
      processingTimeout = setTimeout(() => {
        setShowProcessingIndicator(false);
      }, 300);
      
      removeTimeout = setTimeout(() => {
        setShowRemoveButton(true);
      }, 600);
    }
    
    return () => {
      clearTimeout(processingTimeout);
      clearTimeout(removeTimeout);
    };
  }, [isProcessing, isUploading, isPdf]);

  // Function to determine the file type icon
  const getFileIcon = () => {
    if (!contentType) return <FileIcon size={24} />;
    
    if (contentType.startsWith('image')) {
      return (
        // NOTE: it is recommended to use next/image for images
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt={name ?? 'An image attachment'}
          className="rounded-md size-full object-cover"
        />
      );
    } else if (contentType.includes('pdf')) {
      // Use a wrapper div to add the red color for PDF icons
      return (
        <div className={`text-red-500 transition-opacity duration-300 ${isUploading || showProcessingIndicator ? 'opacity-70' : 'opacity-100'}`}>
          <FileIcon size={24} />
        </div>
      );
    } else if (contentType.includes('excel') || contentType.includes('spreadsheet')) {
      return <TableIcon size={24} />;
    } else {
      return <FileIcon size={24} />;
    }
  };

  return (
    <div 
      data-testid="input-attachment-preview" 
      className="flex flex-col gap-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className={`w-20 h-16 aspect-video bg-muted rounded-md relative flex flex-col items-center justify-center overflow-hidden transition-all duration-300 ${
          isHovered && showRemoveButton ? 'ring-2 ring-blue-400 dark:ring-blue-600' : ''
        }`}
      >
        {/* Background overlay for uploading/processing state */}
        {(isUploading || showProcessingIndicator) && (
          <div className="absolute inset-0 bg-black bg-opacity-5 dark:bg-opacity-20 transition-opacity duration-300"></div>
        )}
        
        {getFileIcon()}

        {/* Upload indicator with pulsing animation */}
        {isUploading && (
          <div
            data-testid="input-attachment-loader"
            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-10 dark:bg-opacity-30 transition-opacity duration-300"
          >
            <div className="animate-spin text-zinc-700 dark:text-zinc-300">
              <LoaderIcon />
            </div>
          </div>
        )}

        {/* PDF Processing Indicator with smooth animation */}
        {isPdf && showProcessingIndicator && !isUploading && (
          <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-300 ease-in-out">
            <div className="absolute top-0 left-0 w-full h-1 bg-gray-200 dark:bg-gray-700">
              <div className="h-full bg-blue-500 animate-progress-indeterminate"></div>
            </div>
            <div className="size-8 rounded-full flex items-center justify-center">
              <div className="size-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
            </div>
          </div>
        )}

        {/* Remove Button with fade-in animation */}
        {isPdf && showRemoveButton && !isUploading && onRemove && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className={`absolute top-1 right-1 size-5 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-all duration-300 ${
              isHovered ? 'opacity-100 scale-110' : 'opacity-80'
            }`}
            aria-label="Remove attachment"
          >
            <CrossIcon size={12} />
          </button>
        )}
      </div>
      <div className="text-xs text-zinc-500 max-w-16 truncate">{name}</div>
    </div>
  );
};
