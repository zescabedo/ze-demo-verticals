import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, Bot, Loader2, Sparkles, X } from 'lucide-react';
import { cn } from '@/shadcn/lib/utils';
import { isParamEnabled } from '@/helpers/isParamEnabled';

type ViewMode = 'closed' | 'modal' | 'compare';

type PreviewDisplayMode = 'formatted' | 'raw';

type AxpMeta = {
  axpVersion: string | null;
  botId: string | null;
  botType: string | null;
};

const getPathFromAsPath = (asPath: string): string => {
  const withoutHash = asPath.split('#')[0] ?? '/';
  const withoutQuery = withoutHash.split('?')[0] ?? '/';
  return withoutQuery || '/';
};

type PreviewDisplayToggleProps = {
  value: PreviewDisplayMode;
  onChange: (mode: PreviewDisplayMode) => void;
  disabled?: boolean;
  className?: string;
};

const PreviewDisplayToggle = ({
  value,
  onChange,
  disabled = false,
  className,
}: PreviewDisplayToggleProps): JSX.Element => (
  <div
    className={cn('border-border bg-background-muted/50 flex rounded-md border p-0.5', className)}
    role="group"
    aria-label="Preview display mode"
  >
    <button
      type="button"
      onClick={() => onChange('formatted')}
      disabled={disabled}
      aria-pressed={value === 'formatted'}
      className={cn(
        'rounded px-3 py-1.5 text-xs font-semibold transition-colors',
        'focus-visible:ring-accent focus-visible:ring-2 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        value === 'formatted'
          ? 'bg-background text-foreground shadow-sm'
          : 'text-foreground-muted hover:text-foreground'
      )}
    >
      Formatted
    </button>
    <button
      type="button"
      onClick={() => onChange('raw')}
      disabled={disabled}
      aria-pressed={value === 'raw'}
      className={cn(
        'rounded px-3 py-1.5 text-xs font-semibold transition-colors',
        'focus-visible:ring-accent focus-visible:ring-2 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        value === 'raw'
          ? 'bg-background text-foreground shadow-sm'
          : 'text-foreground-muted hover:text-foreground'
      )}
    >
      Raw HTML
    </button>
  </div>
);

type AiPreviewContentProps = {
  html: string;
  displayMode: PreviewDisplayMode;
  iframeTitle: string;
};

const AiPreviewContent = ({
  html,
  displayMode,
  iframeTitle,
}: AiPreviewContentProps): JSX.Element => (
  <div className="min-h-0 flex-1 overflow-hidden">
    {displayMode === 'formatted' ? (
      <iframe
        title={iframeTitle}
        srcDoc={html}
        sandbox="allow-same-origin"
        className="h-full w-full border-0 bg-white"
      />
    ) : (
      <div className="h-full overflow-x-auto overflow-y-auto overscroll-contain">
        <pre className="text-foreground bg-[#1e1e1e] p-4 text-xs leading-relaxed">
          <code className="block font-mono break-all whitespace-pre-wrap text-[#d4d4d4]">
            {html}
          </code>
        </pre>
      </div>
    )}
  </div>
);

const AxpPreviewWidget = (): JSX.Element | null => {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('closed');
  const [aiHtml, setAiHtml] = useState<string | null>(null);
  const [axpMeta, setAxpMeta] = useState<AxpMeta>({
    axpVersion: null,
    botId: null,
    botType: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasNoContent, setHasNoContent] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [previewDisplayMode, setPreviewDisplayMode] = useState<PreviewDisplayMode>('formatted');

  const currentPath = useMemo(
    () => (router.isReady ? getPathFromAsPath(router.asPath) : '/'),
    [router.asPath, router.isReady]
  );

  const isHidden =
    router.isReady && isParamEnabled(router.query.hide_demo_tools as string | undefined);

  const humanPageUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return `${currentPath}${currentPath.includes('?') ? '&' : '?'}hide_demo_tools=1`;
    }

    const url = new URL(currentPath, window.location.origin);
    url.searchParams.set('hide_demo_tools', '1');
    return url.toString();
  }, [currentPath]);

  const closeAll = useCallback(() => {
    setViewMode('closed');
    setPreviewDisplayMode('formatted');
  }, []);

  const backToModal = useCallback(() => {
    setViewMode('modal');
  }, []);

  const fetchAxpPreview = useCallback(async () => {
    setIsLoading(true);
    setHasNoContent(false);
    setFetchError(null);
    setAiHtml(null);
    setPreviewDisplayMode('formatted');

    try {
      const response = await fetch(`/api/axp-preview?path=${encodeURIComponent(currentPath)}`, {
        cache: 'no-store',
      });

      if (response.status === 404) {
        setHasNoContent(true);
        return;
      }

      if (!response.ok) {
        setFetchError('Unable to load the AI preview right now. Please try again.');
        return;
      }

      const html = await response.text();
      setAiHtml(html);
      setAxpMeta({
        axpVersion: response.headers.get('x-axp-version'),
        botId: response.headers.get('x-bot-id'),
        botType: response.headers.get('x-bot-type'),
      });
    } catch {
      setFetchError('Unable to load the AI preview right now. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPath]);

  const openModal = useCallback(() => {
    setViewMode('modal');
  }, []);

  const openCompare = useCallback(() => {
    if (!aiHtml) {
      return;
    }

    setViewMode('compare');
  }, [aiHtml]);

  useEffect(() => {
    if (viewMode === 'closed') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAll();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [closeAll, viewMode]);

  useEffect(() => {
    if (viewMode === 'closed') {
      return;
    }

    void fetchAxpPreview();
  }, [currentPath, fetchAxpPreview, viewMode]);

  if (!router.isReady || isHidden) {
    return null;
  }

  return (
    <>
      {viewMode === 'closed' && (
        <button
          type="button"
          onClick={openModal}
          className={cn(
            'bg-foreground text-background fixed right-5 bottom-5 z-[9999] flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg transition-all',
            'hover:bg-foreground/90 focus-visible:ring-accent hover:shadow-xl focus-visible:ring-2 focus-visible:outline-none',
            'motion-safe:animate-pulse motion-safe:hover:animate-none'
          )}
          aria-label="View AI version of this page"
        >
          <Sparkles className="size-4" aria-hidden="true" />
          <span>View AI Version</span>
          <span className="bg-accent/20 text-accent rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
            AXP
          </span>
        </button>
      )}

      {viewMode === 'modal' && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
          onClick={closeAll}
          role="presentation"
        >
          <div
            className="bg-background flex h-[90vh] max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="axp-preview-title"
          >
            <header className="border-border flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4">
              <div className="min-w-0">
                <div className="text-foreground-muted mb-1 flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                  <Bot className="size-3.5" aria-hidden="true" />
                  Scrunch AXP Preview
                </div>
                <h2
                  id="axp-preview-title"
                  className="text-foreground truncate text-lg font-semibold"
                >
                  {currentPath}
                </h2>
                <dl className="text-foreground-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <div className="flex gap-1">
                    <dt>AXP version:</dt>
                    <dd className="text-foreground font-medium">{axpMeta.axpVersion ?? '—'}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt>Bot ID:</dt>
                    <dd className="text-foreground font-medium">{axpMeta.botId ?? '—'}</dd>
                  </div>
                  {axpMeta.botType && (
                    <div className="flex gap-1">
                      <dt>Bot type:</dt>
                      <dd className="text-foreground font-medium">{axpMeta.botType}</dd>
                    </div>
                  )}
                </dl>
              </div>
              <button
                type="button"
                onClick={closeAll}
                className="text-foreground-muted hover:text-foreground hover:bg-background-muted rounded-md p-2 transition-colors"
                aria-label="Close AI preview"
              >
                <X className="size-5" />
              </button>
            </header>

            <div className="bg-background-muted/40 flex min-h-0 flex-1 flex-col overflow-hidden">
              {isLoading && (
                <div className="text-foreground-muted flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
                  <Loader2 className="text-accent size-8 animate-spin" aria-hidden="true" />
                  <p className="text-sm">Loading AI-optimized content…</p>
                </div>
              )}

              {!isLoading && hasNoContent && (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                  <Bot className="text-foreground-muted size-10" aria-hidden="true" />
                  <p className="text-foreground text-base font-medium">
                    No optimized version available for this page
                  </p>
                  <p className="text-foreground-muted max-w-md text-sm">
                    Scrunch AXP does not have indexed content for <code>{currentPath}</code> yet.
                  </p>
                </div>
              )}

              {!isLoading && fetchError && (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                  <p className="text-foreground text-base font-medium">{fetchError}</p>
                  <button
                    type="button"
                    onClick={() => void fetchAxpPreview()}
                    className="bg-accent text-background rounded-md px-4 py-2 text-sm font-semibold hover:opacity-90"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!isLoading && aiHtml && (
                <AiPreviewContent
                  html={aiHtml}
                  displayMode={previewDisplayMode}
                  iframeTitle="AI-optimized page preview"
                />
              )}
            </div>

            <footer className="border-border flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
              <p className="text-foreground-muted text-xs">
                Preview of content served to AI agents via Scrunch AXP
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <PreviewDisplayToggle
                  value={previewDisplayMode}
                  onChange={setPreviewDisplayMode}
                  disabled={!aiHtml || isLoading}
                />
                <button
                  type="button"
                  onClick={openCompare}
                  disabled={!aiHtml || isLoading}
                  className={cn(
                    'border-border text-foreground rounded-md border px-4 py-2 text-sm font-semibold transition-colors',
                    'hover:bg-background-muted focus-visible:ring-accent focus-visible:ring-2 focus-visible:outline-none',
                    'disabled:cursor-not-allowed disabled:opacity-50'
                  )}
                >
                  Compare Side-by-Side
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {viewMode === 'compare' && aiHtml && (
        <div className="fixed inset-0 z-[10000] flex flex-col bg-black/80">
          <header className="bg-foreground text-background flex items-center justify-between gap-4 px-4 py-3">
            <button
              type="button"
              onClick={backToModal}
              className="hover:bg-background/10 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </button>
            <h2 className="truncate text-center text-sm font-semibold md:text-base">
              FormaLux — {currentPath}
            </h2>
            <button
              type="button"
              onClick={closeAll}
              className="hover:bg-background/10 rounded-md p-2 transition-colors"
              aria-label="Close comparison view"
            >
              <X className="size-5" />
            </button>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
            <div className="flex min-h-0 flex-col border-b border-white/10 md:border-r md:border-b-0">
              <div className="bg-background text-foreground border-border border-b px-4 py-2 text-sm font-semibold">
                Human View
              </div>
              <iframe
                title="Human view of current page"
                src={humanPageUrl}
                className="min-h-0 flex-1 border-0 bg-white"
              />
            </div>

            <div className="flex min-h-0 flex-col">
              <div className="bg-background-accent text-foreground border-border flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2">
                <span className="text-sm font-semibold">AI View (served by Scrunch AXP)</span>
                <PreviewDisplayToggle
                  value={previewDisplayMode}
                  onChange={setPreviewDisplayMode}
                  className="bg-background/80"
                />
              </div>
              <AiPreviewContent
                html={aiHtml}
                displayMode={previewDisplayMode}
                iframeTitle="AI view of current page"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AxpPreviewWidget;
