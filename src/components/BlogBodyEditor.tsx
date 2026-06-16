import { useEffect, useId, useRef, useState } from "react";
import { isBlogBodyHtmlEmpty, sanitizeBlogHtml } from "../lib/blogBodyHtml";

type BodyInputMode = "write" | "pdf";

type BlogBodyEditorProps = {
  value: string;
  onChange: (html: string) => void;
  onSuggestTitle?: (title: string) => void;
  disabled?: boolean;
};

function applyCommand(command: string, value?: string) {
  document.execCommand(command, false, value);
}

export function BlogBodyEditor({ value, onChange, onSuggestTitle, disabled }: BlogBodyEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const pdfInputId = useId();
  const [mode, setMode] = useState<BodyInputMode>("write");
  const [importingPdf, setImportingPdf] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const sanitized = sanitizeBlogHtml(value);
    if (editor.innerHTML !== sanitized) {
      editor.innerHTML = sanitized;
    }
  }, [value]);

  function syncEditor() {
    const editor = editorRef.current;
    if (!editor) return;
    onChange(sanitizeBlogHtml(editor.innerHTML));
  }

  async function onPdfSelected(file: File | null) {
    if (!file) return;
    setImportError(null);
    setImportingPdf(true);
    setPdfFileName(file.name);

    try {
      const { pdfFileToBlogHtml, suggestTitleFromBlogHtml } = await import("../lib/pdfToBlogHtml");
      const html = await pdfFileToBlogHtml(file);
      if (isBlogBodyHtmlEmpty(html)) {
        setImportError("No readable text was found in that PDF.");
        return;
      }

      const sanitized = sanitizeBlogHtml(html);
      onChange(sanitized);
      if (onSuggestTitle) {
        const suggested = suggestTitleFromBlogHtml(sanitized);
        if (suggested) onSuggestTitle(suggested);
      }
    } catch {
      setImportError("Could not read that PDF. Try another file or type the post manually.");
    } finally {
      setImportingPdf(false);
    }
  }

  const bodyIsEmpty = isBlogBodyHtmlEmpty(value);

  return (
    <div className="admin-blogBodyEditor">
      <div className="admin-blogBodyMode" role="tablist" aria-label="Body input mode">
        <button
          type="button"
          role="tab"
          className={`admin-blogBodyModeBtn${mode === "write" ? " admin-blogBodyModeBtn--active" : ""}`}
          aria-selected={mode === "write"}
          onClick={() => setMode("write")}
          disabled={disabled || importingPdf}
        >
          Write manually
        </button>
        <button
          type="button"
          role="tab"
          className={`admin-blogBodyModeBtn${mode === "pdf" ? " admin-blogBodyModeBtn--active" : ""}`}
          aria-selected={mode === "pdf"}
          onClick={() => setMode("pdf")}
          disabled={disabled || importingPdf}
        >
          Import from PDF
        </button>
      </div>

      {mode === "pdf" ? (
        <div className="admin-blogPdfPanel">
          <label className="btn btn-secondary admin-blogPdfChoose" htmlFor={pdfInputId}>
            {importingPdf ? "Reading PDF…" : "Choose PDF"}
          </label>
          <input
            id={pdfInputId}
            className="admin-blogPdfInput"
            type="file"
            accept="application/pdf"
            disabled={disabled || importingPdf}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              void onPdfSelected(file);
              event.target.value = "";
            }}
          />
          <p className="form-hint">
            Upload a PDF to convert it into editable body text. Bold headings and paragraph breaks are preserved when
            possible. Review and edit before posting.
          </p>
          {pdfFileName ? <p className="admin-blogPdfName">Last import: {pdfFileName}</p> : null}
          {importError ? (
            <p className="form-error" role="alert">
              {importError}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="form-hint">Type or paste your post. Use the toolbar for bold and italic.</p>
      )}

      <div className="admin-blogBodyToolbar" aria-label="Formatting">
        <button
          type="button"
          className="admin-blogBodyToolbarBtn"
          onClick={() => applyCommand("bold")}
          disabled={disabled || importingPdf}
          aria-label="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className="admin-blogBodyToolbarBtn"
          onClick={() => applyCommand("italic")}
          disabled={disabled || importingPdf}
          aria-label="Italic"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className="admin-blogBodyToolbarBtn"
          onClick={() => applyCommand("formatBlock", "p")}
          disabled={disabled || importingPdf}
        >
          Paragraph
        </button>
        <button
          type="button"
          className="admin-blogBodyToolbarBtn"
          onClick={() => applyCommand("formatBlock", "h2")}
          disabled={disabled || importingPdf}
        >
          Heading
        </button>
      </div>

      <div
        ref={editorRef}
        className={`admin-blogBodySurface${bodyIsEmpty ? " admin-blogBodySurface--empty" : ""}`}
        contentEditable={!disabled && !importingPdf}
        role="textbox"
        aria-multiline="true"
        aria-label="Blog post body"
        data-placeholder="Write or import your post body here…"
        onInput={syncEditor}
        onBlur={syncEditor}
        suppressContentEditableWarning
      />

      <input
        tabIndex={-1}
        aria-hidden
        className="admin-blogBodyRequired"
        value={bodyIsEmpty ? "" : "filled"}
        onChange={() => undefined}
        required
      />
    </div>
  );
}
