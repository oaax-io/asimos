import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

type Props = {
  title?: ReactNode;
  description?: string;
  /** When provided, title/description are resolved from `pages.{i18nKey}.title/description`. */
  i18nKey?: string;
  action?: ReactNode;
};

export function PageHeader({ title, description, i18nKey, action }: Props) {
  const { t } = useTranslation();
  const resolvedTitle = i18nKey ? t(`pages.${i18nKey}.title`, { defaultValue: title ?? "" }) : title;
  const resolvedDescription = i18nKey
    ? t(`pages.${i18nKey}.description`, { defaultValue: description ?? "" })
    : description;
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight inline-flex items-center gap-2.5">{resolvedTitle}</h1>
        {resolvedDescription && (
          <p className="mt-1 text-sm text-muted-foreground">{resolvedDescription}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}
