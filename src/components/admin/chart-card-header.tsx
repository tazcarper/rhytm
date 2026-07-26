export function ChartCardHeader({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-eyebrow font-semibold uppercase tracking-label text-gray">
        {eyebrow}
      </span>
      <span className="font-serif text-h3 leading-tight text-olive">
        {title}
      </span>
      <span className="text-micro text-gray">{detail}</span>
    </div>
  );
}
