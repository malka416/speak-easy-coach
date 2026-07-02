export function LiveTranscript({ finalText, interim }: { finalText: string; interim: string }) {
  if (!finalText && !interim) return null;
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-muted/40 px-4 py-3 text-sm">
      <span className="font-medium text-foreground">{finalText}</span>
      {interim && <span className="text-muted-foreground"> {interim}</span>}
    </div>
  );
}