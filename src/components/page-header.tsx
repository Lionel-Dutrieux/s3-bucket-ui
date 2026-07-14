/**
 * Dokploy-style page header for admin pages: title + one-line description on
 * the left, the page's primary action on the right.
 */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {children ? <div className="flex shrink-0 gap-2">{children}</div> : null}
    </div>
  );
}
