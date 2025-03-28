import { Message } from 'ai';
import { toast } from 'sonner';
import { memo } from 'react';
import { useCopyToClipboard } from 'usehooks-ts';
import { cn } from '@/lib/utils';

import { CopyIcon } from './icons';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import equal from 'fast-deep-equal';

function CopyButton({ message }: { message: Message }) {
  const [_, copyToClipboard] = useCopyToClipboard();
  
  return (
    <Button
      className="py-1 px-2 h-fit text-muted-foreground !pointer-events-auto"
      variant="outline"
      onClick={() => {
        if (message.content) {
          copyToClipboard(message.content as string);
          toast.success('Copied to clipboard!');
        }
      }}
    >
      <CopyIcon />
    </Button>
  );
}

function PureMessageActions({
  message,
  isLoading,
}: {
  chatId: string;
  message: Message;
  vote?: any;
  isLoading: boolean;
}) {
  if (isLoading) return null;

  return (
    <div
      className={cn(
        'flex flex-row items-center gap-2 invisible group-hover/message:visible justify-end',
        {
          'opacity-50': isLoading,
        },
      )}
    >
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <CopyButton message={message} />
          </TooltipTrigger>
          <TooltipContent>Copy</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    return true;
  },
);
