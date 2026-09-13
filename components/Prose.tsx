import { splitParagraphs } from "@/lib/parseReadout";

export default function Prose({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length === 0) return null;
  return (
    <div className={className}>
      {paragraphs.map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}
    </div>
  );
}
