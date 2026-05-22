import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/ui";
import s from "./markdown.module.css";

const COMPONENTS: Components = {
  a: ({ href, children, ...rest }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  ),
};

const ALLOWED_URI = /^(https?:|mailto:|tel:)/i;

interface MarkdownProseProps {
  children: string;
  small?: boolean;
  className?: string;
}

export function MarkdownProse({
  children,
  small = false,
  className,
}: MarkdownProseProps) {
  return (
    <div className={cn(s.prose, small && s.proseSmall, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (ALLOWED_URI.test(url) ? url : "")}
        components={COMPONENTS}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
