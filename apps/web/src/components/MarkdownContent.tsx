import React from 'react';

interface MarkdownContentProps {
  markdown: string;
}

function renderInline(text: string): Array<string | React.JSX.Element> {
  const segments = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return segments.map((segment, index) => {
    if (segment.startsWith('**') && segment.endsWith('**')) {
      return <strong key={`bold-${index}`}>{segment.slice(2, -2)}</strong>;
    }
    return segment;
  });
}

const MarkdownContent: React.FC<MarkdownContentProps> = ({ markdown }) => {
  const lines = markdown.split(/\r?\n/);
  const blocks: React.JSX.Element[] = [];
  let listItems: string[] = [];
  let paragraphLines: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`list-${blocks.length}`} className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
        {listItems.map((item, index) => (
          <li key={`item-${index}`}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push(
      <p key={`p-${blocks.length}`} className="text-sm leading-6 text-slate-700 dark:text-slate-300">
        {renderInline(paragraphLines.join(' '))}
      </p>,
    );
    paragraphLines = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      flushParagraph();
      return;
    }

    if (line.startsWith('# ')) {
      flushList();
      flushParagraph();
      blocks.push(
        <h1 key={`h1-${blocks.length}`} className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {line.slice(2)}
        </h1>,
      );
      return;
    }

    if (line.startsWith('## ')) {
      flushList();
      flushParagraph();
      blocks.push(
        <h2 key={`h2-${blocks.length}`} className="pt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          {line.slice(3)}
        </h2>,
      );
      return;
    }

    if (line.startsWith('- ')) {
      flushParagraph();
      listItems.push(line.slice(2));
      return;
    }

    paragraphLines.push(line);
  });

  flushList();
  flushParagraph();

  return <div className="space-y-4">{blocks}</div>;
};

export default MarkdownContent;
