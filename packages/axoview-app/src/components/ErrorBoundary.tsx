import './ErrorBoundary.css';

interface ErrorBoundaryFallbackUIProps {
  // react-error-boundary v6 types the thrown value as `unknown` (anything can
  // be thrown); normalised to an Error below so the UI can render it.
  error: unknown;
}

export default function ErrorBoundaryFallbackUI({
  error
}: ErrorBoundaryFallbackUIProps) {
  const err = error instanceof Error ? error : new Error(String(error));
  const onRefreshButtonPressed = () => {
    window.location.reload();
  };

  const onReportButtonPressed = () => {
    // Strip query string and hash before it leaves the app: this URL is opened
    // in an externally-hosted GitHub issue form, and search/fragment params can
    // carry sensitive data (e.g. an OAuth token in the fragment once Drive ships).
    // Origin + pathname is enough to locate the failing view (security review 2026-07-05).
    const safeUrl = `${window.location.origin}${window.location.pathname}`;
    const errorDetails = {
      message: err.message,
      stack: err.stack,
      userAgent: navigator.userAgent,
      url: safeUrl,
      timestamp: new Date().toISOString()
    };

    const githubUrl = new URL(
      'https://github.com/molikas/axoview/issues/new'
    );
    githubUrl.searchParams.set('title', `Error: ${err.message}`);
    githubUrl.searchParams.set(
      'body',
      `## Error Details\n\n\`\`\`\n${JSON.stringify(errorDetails, null, 2)}\n\`\`\`\n\n## Steps to Reproduce\n1. \n2. \n3. \n\n## Expected Behavior\n\n## Actual Behavior\n\n## Environment\n- Browser: ${navigator.userAgent}\n- URL: ${safeUrl}\n- Timestamp: ${new Date().toISOString()}`
    );

    window.open(githubUrl.toString(), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="error-page-container">
      <div className="error-container">
        <div className="error-header">
          <p>⚠️ Something went wrong!</p>
        </div>
        <div className="error-content">
          <p>
            <strong>Error:</strong> {err.message}
          </p>
          {err.stack && (
            <details style={{ marginTop: '10px' }}>
              <summary
                style={{ cursor: 'pointer', fontSize: '12px', color: '#666' }}
              >
                Show technical details
              </summary>
              <pre
                style={{
                  fontSize: '11px',
                  color: '#666',
                  margin: '10px 0 0 0',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}
              >
                {err.stack}
              </pre>
            </details>
          )}
        </div>

        <div
          style={{
            backgroundColor: '#d1ecf1',
            border: '1px solid #bee5eb',
            borderRadius: '4px',
            padding: '15px',
            marginBottom: '20px',
            fontSize: '14px',
            color: '#0c5460'
          }}
        >
          <p style={{ margin: '0 0 10px 0', fontWeight: '600' }}>
            📋 Before reporting this error:
          </p>
          <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
            <li>
              Check if this error has already been reported{' '}
              <a
                href="https://github.com/molikas/axoview/issues"
                target="_"
              >
                here👀
              </a>
            </li>
            <li>Try refreshing the page first</li>
            <li>Only report if this is a new, unreported issue</li>
          </ul>
          <p style={{ margin: 0, fontSize: '13px' }}>
            <strong>Note:</strong> If you can't find a similar issue, please
            report it with the details below.
          </p>
        </div>

        <div className="error-footer">
          <button className="error-button" onClick={onReportButtonPressed}>
            📋 Report Issue
          </button>
          <button
            className="error-button refresh-button"
            onClick={onRefreshButtonPressed}
          >
            🔄 Refresh Page
          </button>
        </div>
      </div>
    </div>
  );
}
