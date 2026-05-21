import s from "./step-confirmation.module.css";

interface StepConfirmationProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  hint: string;
}

export function StepConfirmation({
  eyebrow,
  title,
  subtitle,
  hint,
}: StepConfirmationProps) {
  return (
    <div className={s.box}>
      <p className={s.eyebrow}>{eyebrow}</p>
      <p className={s.title}>{title}</p>
      {subtitle && <p className={s.subtitle}>{subtitle}</p>}
      <div className={s.divider} />
      <p className={s.hint}>{hint}</p>
    </div>
  );
}
