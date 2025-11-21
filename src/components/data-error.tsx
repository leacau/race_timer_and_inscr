type DataErrorProps = {
  message: string;
  description?: string;
};

export function DataError({ message, description }: DataErrorProps) {
  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
      <p className="font-medium">{message}</p>
      {description ? <p className="mt-1 text-destructive/80">{description}</p> : null}
    </div>
  );
}
