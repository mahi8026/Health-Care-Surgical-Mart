/**
 * ScannerPanel
 * POS barcode scanner panel.
 *
 * Supports two input paths:
 *  1. USB/Laser keyboard-wedge scanners — devices that "type" the code
 *     faster than a human. A document-level listener detects the rapid
 *     keystroke burst and treats the trailing ENTER as a scan, even when
 *     focus is elsewhere on the page.
 *  2. Manual entry / camera scan — a focused input plus a camera modal.
 *
 * `onScan(code)` is async; it should resolve with the added cart line
 * `{ name, rate, quantity }` or throw an Error with a message intended for
 * the operator.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  Suspense,
  lazy,
} from "react";
import { ScanLine, Camera, Volume2 } from "lucide-react";
import { beepSuccess, beepError } from "../utils/scannerSound";

// Lazy-load the camera scanner (pulls in @zxing) only when the camera opens,
// so it doesn't inflate the Sales page bundle.
const BarcodeScannerModal = lazy(() => import("./BarcodeScannerModal"));

// Gap between keystrokes (ms) below which a burst is treated as a scanner.
const WEDGE_SCAN_GAP_MS = 30;
// Keep history short — operators scan dozens of items quickly.
const MAX_HISTORY = 6;

const EMPTY_BUFFER = {
  keys: [],
  lastKeyAt: 0,
  leakTarget: null,
  leakValue: null,
};

const ScannerPanel = ({ onScan, disabled = false, autoFocus = true }) => {
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lastError, setLastError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [beepEnabled, setBeepEnabled] = useState(true);
  const [history, setHistory] = useState([]);

  const inputRef = useRef(null);
  const wedgeBufferRef = useRef({ ...EMPTY_BUFFER });

  const beep = useCallback(
    (success) => {
      if (!beepEnabled) return;
      if (success) beepSuccess();
      else beepError();
    },
    [beepEnabled],
  );

  const refocus = useCallback(() => {
    if (inputRef.current && !cameraOpen && !disabled) {
      inputRef.current.focus();
    }
  }, [cameraOpen, disabled]);

  const submit = useCallback(
    async (rawCode) => {
      const trimmed = String(rawCode || "").trim();
      if (!trimmed || scanning) return;

      setScanning(true);
      setLastError("");
      try {
        const line = await onScan(trimmed);
        setHistory((prev) =>
          [
            { code: trimmed, ok: true, ...line, time: Date.now() },
            ...prev,
          ].slice(0, MAX_HISTORY),
        );
        beep(true);
      } catch (err) {
        const message = err?.message || "Product not found";
        setLastError(`${trimmed}: ${message}`);
        setHistory((prev) =>
          [
            { code: trimmed, ok: false, error: message, time: Date.now() },
            ...prev,
          ].slice(0, MAX_HISTORY),
        );
        beep(false);
      } finally {
        setScanning(false);
        setCode("");
        refocus();
      }
    },
    [onScan, scanning, beep, refocus],
  );

  // Keyboard-wedge scanner detection.
  // When typing happens much faster than a human (< 30ms between keys) in a
  // field that is NOT the scan input, we assume a scanner is entering a code.
  useEffect(() => {
    // Undo the first character of a confirmed burst: on the first key of a
    // burst we cannot yet know it is a scanner, so the char goes to the
    // focused field normally; once the second key confirms the burst we
    // restore the field to its pre-scan value (captured at the first keydown,
    // which fires before the input event mutates the value).
    const restoreLeakedChar = (buffer) => {
      const { leakTarget, leakValue } = buffer;
      buffer.leakTarget = null;
      buffer.leakValue = null;
      if (!leakTarget || leakValue === null || leakValue === undefined) return;
      if (leakTarget !== document.activeElement) return;
      if (leakTarget.value === leakValue) return;
      leakTarget.value = leakValue;
      if (typeof leakTarget.setSelectionRange === "function") {
        leakTarget.setSelectionRange(leakValue.length, leakValue.length);
      }
    };

    const onKeyDown = (e) => {
      const buffer = wedgeBufferRef.current;

      // The focused scan input is handled by its own onKeyDown/onChange.
      if (e.target === inputRef.current) {
        buffer.keys = [];
        buffer.lastKeyAt = 0;
        buffer.leakTarget = null;
        buffer.leakValue = null;
        return;
      }

      const now = Date.now();
      const duration = now - buffer.lastKeyAt;

      if (e.key === "Enter") {
        if (buffer.keys.length >= 1 && duration <= 160 && buffer.lastKeyAt !== 0) {
          const scanned = buffer.keys.join("");
          restoreLeakedChar(buffer);
          buffer.keys = [];
          buffer.lastKeyAt = 0;
          e.preventDefault();
          e.stopPropagation();
          submit(scanned);
        } else {
          buffer.keys = [];
          buffer.lastKeyAt = 0;
          buffer.leakTarget = null;
          buffer.leakValue = null;
        }
        return;
      }

      // Reset on modifier/shortcut keys so shortcuts aren't swallowed.
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) {
        buffer.keys = [];
        buffer.lastKeyAt = 0;
        buffer.leakTarget = null;
        buffer.leakValue = null;
        return;
      }

      // Empty buffer → potential start of a scanner burst. Accept the key so
      // the first character is never dropped, and record the focused field
      // so a confirmed burst can undo the (unavoidable) leak below.
      if (buffer.keys.length === 0) {
        buffer.keys.push(e.key);
        buffer.lastKeyAt = now;
        const target = document.activeElement;
        buffer.leakTarget = target;
        buffer.leakValue =
          target && typeof target.value === "string" ? target.value : null;
        return;
      }

      // If the gap between keys exceeds the wedge threshold, a human is
      // typing — abandon the burst and do not swallow this keystroke so
      // normal inputs keep working.
      if (duration > WEDGE_SCAN_GAP_MS) {
        buffer.keys = [];
        buffer.lastKeyAt = 0;
        buffer.leakTarget = null;
        buffer.leakValue = null;
        return;
      }

      // Second key within the gap confirms the burst: undo the leaked first
      // character now, then accumulate and suppress the remaining keys so
      // they don't leak into the focused field.
      if (buffer.keys.length === 1) {
        restoreLeakedChar(buffer);
      }
      buffer.keys.push(e.key);
      buffer.lastKeyAt = now;
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [submit]);

  // Auto-focus on mount so a wedge scanner can type directly into the box.
  useEffect(() => {
    if (autoFocus && inputRef.current && !disabled) {
      inputRef.current.focus();
    }
  }, [autoFocus, disabled]);

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit(code);
    }
    if (e.key === "Escape") {
      setCode("");
    }
  };

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-100">
        <div className="flex items-center gap-2 text-emerald-800">
          <ScanLine className="h-4 w-4" />
          <span className="text-sm font-semibold">Barcode Scanner</span>
          <span className="text-xs text-emerald-600 hidden sm:inline">
            Scan or type the code, press Enter
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBeepEnabled((v) => !v)}
            title={beepEnabled ? "Beep on" : "Beep off"}
            className={`p-1.5 rounded transition-colors ${
              beepEnabled
                ? "text-emerald-700 hover:bg-emerald-100"
                : "text-gray-400 hover:bg-gray-100"
            }`}
          >
            <Volume2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5" />
            Camera
          </button>
        </div>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Scan / type barcode or SKU..."
            autoFocus={autoFocus}
            disabled={scanning || disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono tracking-wider uppercase placeholder:normal-case placeholder:text-gray-400"
          />
          {scanning && (
            <span className="text-xs text-emerald-600 animate-pulse whitespace-nowrap">
              Adding&hellip;
            </span>
          )}
        </div>

        {lastError && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1.5">
            {lastError}
          </p>
        )}

        {history.length > 0 && (
          <div className="border-t border-emerald-100 pt-2">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">
              Recent scans
            </p>
            <ul className="space-y-0.5 max-h-28 overflow-y-auto">
              {history.map((h, idx) => (
                <li
                  key={`${h.code}-${h.time}-${idx}`}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    {h.ok ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
                    )}
                    <span className="font-mono truncate">{h.code}</span>
                  </span>
                  {h.ok ? (
                    <span className="text-gray-600 truncate">
                      {h.name} &middot; {h.quantity} &times; ৳
                      {Number(h.rate).toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-red-600 truncate">{h.error}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Suspense fallback={null}>
        <BarcodeScannerModal
          isOpen={cameraOpen}
          onClose={() => {
            setCameraOpen(false);
            refocus();
          }}
          onScan={(scannedCode) => {
            setCameraOpen(false);
            submit(scannedCode);
          }}
        />
      </Suspense>
    </div>
  );
};

export default ScannerPanel;