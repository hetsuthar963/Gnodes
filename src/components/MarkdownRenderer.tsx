import React from 'react';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'dompurify';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const purifyConfig: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 'strike', 'code', 'pre', 'h1', 'h2', 'h3', 
    'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'table', 'thead',
    'tbody', 'tr', 'th', 'td', 'hr', 'div', 'span', 'del', 'ins', 'sup', 'sub'
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel', 'width', 'height'
  ],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  SANITIZE_DOM: true,
  USE_PROFILES: { html: true }
};

const sanitizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    const allowedProtocols = ['http:', 'https:', 'mailto:', 'github:', 'git:'];
    
    if (!allowedProtocols.includes(parsed.protocol)) {
      return '#';
    }
    
    return url;
  } catch {
    return '#';
  }
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  className = '' 
}) => {
  const sanitizedContent = React.useMemo(() => {
    if (!content) return '';
    
    let cleaned = DOMPurify.sanitize(content, purifyConfig as any) as unknown as string;
    
    cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    cleaned = cleaned.replace(/javascript:/gi, '');
    cleaned = cleaned.replace(/on\w+=\s*["'][^"']*["']/gi, '');
    
    return cleaned;
  }, [content]);

  const components = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      
      const codeContent = String(children).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      
      return !inline && language ? (
        <SyntaxHighlighter
          style={vs}
          language={language}
          PreTag="div"
          {...props}
        >
          {codeContent}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {codeContent}
        </code>
      );
    },
    
    a({ href, children, ...props }: any) {
      const safeHref = sanitizeUrl(href);
      const isExternal = safeHref.startsWith('http');
      
      return (
        <a
          href={safeHref}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          {...props}
        >
          {children}
        </a>
      );
    },
    
    img({ src, alt, ...props }: any) {
      const safeSrc = sanitizeUrl(src);
      return <img src={safeSrc} alt={alt || 'Image'} loading="lazy" {...props} />;
    }
  };

  return (
    <div className={`markdown-renderer prose prose-sm max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={components as any}
      >
        {sanitizedContent}
      </ReactMarkdown>
    </div>
  );
};
