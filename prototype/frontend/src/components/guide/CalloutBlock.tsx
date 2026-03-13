import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';

type CalloutVariant = 'tip' | 'warning' | 'info';

interface CalloutBlockProps {
  variant: CalloutVariant;
  children: string;
}

/**
 * Renders a styled callout block for tip, warning, or info content.
 * Used by ContentRenderer for ```callout-tip/warning/info code blocks.
 * Supports inline markdown (links, bold, italic, code) within callout content.
 */
const CalloutBlock: React.FC<CalloutBlockProps> = ({ variant, children }) => {
  const variantStyles: Record<CalloutVariant, string> = {
    tip: 'border-green-500 bg-green-900/20 text-green-300',
    warning: 'border-yellow-500 bg-yellow-900/20 text-yellow-300',
    info: 'border-blue-500 bg-blue-900/20 text-blue-300',
  };

  const variantLabels: Record<CalloutVariant, string> = {
    tip: '💡 Tip',
    warning: '⚠️ Warning',
    info: 'ℹ️ Info',
  };

  return (
    <div className={`my-4 rounded-lg border-l-4 p-4 min-w-0 ${variantStyles[variant]}`}>
      <p className="mb-2 text-sm font-semibold">{variantLabels[variant]}</p>
      <div className="break-words callout-content" style={{ overflowWrap: 'anywhere' }}>
        <ReactMarkdown
          components={{
            p: ({ children: pChildren }) => (
              <p className="mb-2 last:mb-0">{pChildren}</p>
            ),
            a: ({ href, children: linkChildren }) => {
              if (href && href.startsWith('/guide/')) {
                return (
                  <Link to={href} className="underline hover:text-white">
                    {linkChildren}
                  </Link>
                );
              }
              return (
                <a href={href} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                  {linkChildren}
                </a>
              );
            },
            code: ({ children: codeChildren }) => (
              <code className="rounded bg-gray-800 px-1.5 py-0.5 text-sm">{codeChildren}</code>
            ),
          }}
        >
          {children}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default CalloutBlock;
