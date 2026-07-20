import React from 'react';

/**
 * LinkifiedText
 * Renders message text with:
 *  - clickable http(s) links (open in a new tab)
 *  - long URLs/words wrapped instead of overflowing the bubble
 *  - preserved line breaks (whitespace-pre-wrap)
 */

// Splitting regex keeps the URL as a captured group so split() returns it.
const URL_SPLIT = /(https?:\/\/[^\s]+)/g;
// Non-global test regex (avoids stateful lastIndex issues).
const URL_TEST = /^https?:\/\/[^\s]+$/;

interface LinkifiedTextProps {
  text: string;
  className?: string;
  linkClassName?: string;
  style?: React.CSSProperties;
}

export const LinkifiedText: React.FC<LinkifiedTextProps> = ({
  text,
  className = '',
  linkClassName = 'underline break-all hover:opacity-80',
  style,
}) => {
  if (!text) return null;

  const parts = text.split(URL_SPLIT);

  return (
    <span className={`whitespace-pre-wrap break-words ${className}`} style={style}>
      {parts.map((part, i) => {
        if (URL_TEST.test(part)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={linkClassName}
              style={{ color: 'inherit' }}
            >
              {part}
            </a>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
};

export default LinkifiedText;
