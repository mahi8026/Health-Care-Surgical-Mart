/**
 * BarcodeScannerModal
 * Camera-based barcode scanning for the POS using @zxing/browser.
 * Uses getUserMedia constraints (facingMode: 'environment') which is the
 * reliable way to pick the rear camera on phones — device enumeration
 * returns unusable/empty labels on several mobile browsers.
 * TRY_HARDER + 1D-format hints keep decoding fast and accurate on camera.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
} from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import Modal from "./ui/Modal";
import { beepSuccess } from "../utils/scannerSound";

// Restrict decoding to linear (1D) barcodes + QR. Excluding PDF417/DataMatrix
// lets the decoder spend its time on the codes a retail POS sees.
const POSSIBLE_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.QR_CODE,
];

const VIDEO_CONSTRAINTS = {
  audio: false,
  video: {
    facingMode: "environment",
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
};

const BarcodeScannerModal = ({
  isOpen,
  onClose,
  onScan,
  title = "Scan barcode",
  hint = "Point the camera at the product barcode. The item is added to the cart automatically when a code is detected.",
}) => {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [error, setError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const scanLockRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return undefined;

    let cancelled = false;
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, POSSIBLE_FORMATS);
    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 100,
    });

    const start = async () => {
      try {
        const controls = await reader.decodeFromConstraints(
          VIDEO_CONSTRAINTS,
          videoRef.current,
          (result) => {
            if (cancelled || scanLockRef.current) return;
            if (result) {
              scanLockRef.current = true;
              beepSuccess();
              onScan(result.getText());
            }
          },
        );
        controlsRef.current = controls;
        if (!cancelled) setCameraReady(true);
      } catch (startError) {
        if (cancelled) return;
        console.error("Camera scan error:", startError);
        const name = startError?.name || "";
        setError(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Camera permission was denied. Allow camera access in your browser settings, or use the USB scanner instead."
            : name === "NotFoundError"
              ? "No camera found on this device. Use the USB scanner or type the code instead."
              : "Unable to access the camera. Allow camera permission or use the USB scanner instead.",
        );
      }
    };

    start();

    return () => {
      cancelled = true;
      scanLockRef.current = false;
      if (controlsRef.current) {
        try {
          controlsRef.current.stop();
        } catch {
          /* ignore */
        }
        controlsRef.current = null;
      }
    };
  }, [isOpen, onScan]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{hint}</p>

        <div className="relative bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full aspect-video object-cover"
            muted
            playsInline
            autoPlay
          />
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 opacity-80 pointer-events-none" />
        </div>

        {!cameraReady && !error && (
          <p className="text-center text-sm text-gray-400">
            Starting camera...
          </p>
        )}

        {error && (
          <p className="text-center text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default BarcodeScannerModal;