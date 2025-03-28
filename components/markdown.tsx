import Link from 'next/link';
import React, { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { CodeBlock } from './code-block';

// Custom component to handle code blocks outside of paragraphs
const CodeWrapper = ({ node, inline, className, children, ...props }: any) => {
  if (inline) {
    return (
      <code
        className={`${className} text-sm bg-zinc-100 dark:bg-zinc-800 py-0.5 px-1 rounded-md`}
        {...props}
      >
        {children}
      </code>
    );
  }
  
  // For block code, render directly without any paragraph wrapper
  return (
    <div className="not-prose flex flex-col">
      <pre
        className="text-sm w-full overflow-x-auto dark:bg-zinc-900 p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl dark:text-zinc-50 text-zinc-900"
      >
        <code className="whitespace-pre-wrap break-words">{children}</code>
      </pre>
    </div>
  );
};

const components: Partial<Components> = {
  code: CodeWrapper,
  // Custom component for thinking tags
  thinking: ({ node, children, ...props }) => {
    return (
      <div className="thinking-container my-2 p-2 border-l-2 border-blue-300 bg-gray-50 dark:bg-gray-800 rounded">
        <div className="text-gray-500 dark:text-gray-400 italic text-sm">
          <span className="font-medium">🤔 Thinking: </span>
          {children}
        </div>
      </div>
    );
  },
  // Override the default paragraph renderer to skip paragraphs that only contain code blocks
  paragraph: ({ node, children, ...props }) => {
    // Check if this paragraph contains only a code block
    const childNodes = node.children || [];
    const hasOnlyCodeBlock = 
      childNodes.length === 1 && 
      childNodes[0].type === 'element' && 
      (childNodes[0].tagName === 'pre' || 
       (childNodes[0].tagName === 'code' && childNodes[0].properties?.className?.includes('language-')));

    if (hasOnlyCodeBlock) {
      return <>{children}</>;
    }
    
    return <p {...props}>{children}</p>;
  },
  // Remove the pre component to prevent nesting issues
  pre: ({ children }) => <>{children}</>,
  ol: ({ node, children, ...props }) => {
    return (
      <ol className="list-decimal list-outside ml-4" {...props}>
        {children}
      </ol>
    );
  },
  li: ({ node, children, ...props }) => {
    return (
      <li className="py-1" {...props}>
        {children}
      </li>
    );
  },
  ul: ({ node, children, ...props }) => {
    return (
      <ul className="list-decimal list-outside ml-4" {...props}>
        {children}
      </ul>
    );
  },
  strong: ({ node, children, ...props }) => {
    return (
      <span className="font-semibold" {...props}>
        {children}
      </span>
    );
  },
  a: ({ node, children, ...props }) => {
    return (
      // @ts-expect-error
      <Link
        className="text-blue-500 hover:underline"
        target="_blank"
        rel="noreferrer"
        {...props}
      >
        {children}
      </Link>
    );
  },
  h1: ({ node, children, ...props }) => {
    return (
      <h1 className="text-3xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h1>
    );
  },
  h2: ({ node, children, ...props }) => {
    return (
      <h2 className="text-2xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h2>
    );
  },
  h3: ({ node, children, ...props }) => {
    return (
      <h3 className="text-xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h3>
    );
  },
  h4: ({ node, children, ...props }) => {
    return (
      <h4 className="text-lg font-semibold mt-6 mb-2" {...props}>
        {children}
      </h4>
    );
  },
  h5: ({ node, children, ...props }) => {
    return (
      <h5 className="text-base font-semibold mt-6 mb-2" {...props}>
        {children}
      </h5>
    );
  },
  h6: ({ node, children, ...props }) => {
    return (
      <h6 className="text-sm font-semibold mt-6 mb-2" {...props}>
        {children}
      </h6>
    );
  },
};

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeRaw];

const NonMemoizedMarkdown = ({ children }: { children: string }) => {
  return (
    <ReactMarkdown 
      remarkPlugins={remarkPlugins} 
      rehypePlugins={rehypePlugins}
      components={components}
    >
      {children}
    </ReactMarkdown>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
