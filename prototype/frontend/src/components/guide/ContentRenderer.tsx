import React, { useState, useCallback } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import MermaidDiagram from './MermaidDiagram';
import CalloutBlock from './CalloutBlock';

interface ContentRendererProps {
  content: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const ImageWithFallback: React.FC<
  React.ImgHTMLAttributes<HTMLImageElement>
> = ({ alt, ...props }) => {
  const [hasError, setHasError] = useState(false);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  if (hasError) {
    return (
      <div className="my-4 flex items-center justify-center rounded-lg border border-gray-700 bg-gray-800 p-8 text-sm text-gray-400">
        {alt || 'Image could not be loaded'}
      </div>
    );
  }

  return (
    <img
      {...props}
      alt={alt || ''}
      loading="lazy"
      onError={handleError}
      className="my-4 max-w-full rounded-lg"
    />
  );
};

const ContentRenderer: React.FC<ContentRendererProps> = ({ content }) => {
  const components: Components = {
    h1: ({ children }) => {
      const text = extractText(children);
      return (
        <h1 id={slugify(text)} className="mb-4 mt-8 text-3xl font-bold text-white">
          {children}
        </h1>
      );
    },
    h2: ({ children }) => {
      const text = extractText(children);
      return (
        <h2 id={slugify(text)} className="mb-3 mt-6 text-2xl font-semibold text-white">
          {children}
        </h2>
      );
    },
    h3: ({ children }) => {
      const text = extractText(children);
      return (
        <h3 id={slugify(text)} className="mb-2 mt-4 text-xl font-semibold text-gray-200">
          {children}
        </h3>
      );
    },
    h4: ({ children }) => {
      const text = extractText(children);
      return (
        <h4 id={slugify(text)} className="mb-2 mt-3 text-lg font-medium text-gray-200">
          {children}
        </h4>
      );
    },
    code: ({ className, children, ...props }) => {
      const match = /language-(\S+)/.exec(className || '');
      const language = match ? match[1] : '';
      const codeContent = String(children).replace(/\n$/, '');

      // Check if this is a block-level code (has language class from fenced code block)
      const isInline = !className;

      if (isInline) {
        return (
          <code className="rounded bg-gray-800 px-1.5 py-0.5 text-sm text-gray-300" {...props}>
            {children}
          </code>
        );
      }

      if (language === 'mermaid') {
        return <MermaidDiagram chart={codeContent} />;
      }

      const calloutMatch = /^callout-(tip|warning|info)$/.exec(language);
      if (calloutMatch) {
        const variant = calloutMatch[1] as 'tip' | 'warning' | 'info';
        return <CalloutBlock variant={variant}>{codeContent}</CalloutBlock>;
      }

      return (
        <pre className="overflow-x-auto rounded-lg bg-gray-800 p-4">
          <code className={`text-sm text-gray-300 ${className || ''}`} {...props}>
            {children}
          </code>
        </pre>
      );
    },
    pre: ({ children }) => {
      return <div className="my-4">{children}</div>;
    },
    img: ({ src, alt }) => {
      return <ImageWithFallback src={src} alt={alt} />;
    },
    table: ({ children }) => {
      return (
        <div className="my-4 overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-700 text-sm">
            {children}
          </table>
        </div>
      );
    },
    thead: ({ children }) => {
      return <thead className="bg-gray-800">{children}</thead>;
    },
    th: ({ children }) => {
      return (
        <th className="border border-gray-700 px-4 py-2 text-left font-semibold text-gray-200">
          {children}
        </th>
      );
    },
    td: ({ children }) => {
      return (
        <td className="border border-gray-700 px-4 py-2 text-gray-300">
          {children}
        </td>
      );
    },
    a: ({ href, children }) => {
      if (href && href.startsWith('/guide/')) {
        return (
          <Link to={href} className="text-blue-400 underline hover:text-blue-300">
            {children}
          </Link>
        );
      }

      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 underline hover:text-blue-300"
        >
          {children}
        </a>
      );
    },
    p: ({ children }) => {
      return <p className="mb-4 leading-relaxed text-gray-300 break-words">{children}</p>;
    },
    ul: ({ children }) => {
      return <ul className="mb-4 ml-6 list-disc space-y-1 text-gray-300">{children}</ul>;
    },
    ol: ({ children }) => {
      return <ol className="mb-4 ml-6 list-decimal space-y-1 text-gray-300">{children}</ol>;
    },
    li: ({ children }) => {
      return <li className="leading-relaxed">{children}</li>;
    },
    blockquote: ({ children }) => {
      return (
        <blockquote className="my-4 border-l-4 border-gray-600 pl-4 italic text-gray-400">
          {children}
        </blockquote>
      );
    },
    hr: () => {
      return <hr className="my-6 border-gray-700" />;
    },
  };

  return (
    <div className="guide-content min-w-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
};

function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (React.isValidElement(children) && children.props?.children) {
    return extractText(children.props.children);
  }
  return '';
}

export default ContentRenderer;
