/**
 * BarcodeScannerModal
 * Camera-based barcode scanning for the POS using @zxing/browser.
 * Continuously decodes the video feed and reports the first detected code.
 */

import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import Modal from "./ui/Modal";
import { beepSuccess } from "../utils/scannerSound";

const BarcodeScannerModal = ({
  isOpen,
  onClose,
  onScan,
  title = "Scan barcode",
}) => {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [error, setError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const scanLockRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return undefined;

    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    const start = async () => {
      try {
        // Prefer the rear camera if multiple devices exist (common on mobile)
        let desiredDevice = undefined;
        try {
          const devices = await reader.listVideoInputDevices();
          const rear = devices.find((dev) =>
            /back|environment|rear/i.test(dev.label || ""),
          );
          desiredDevice = (rear || devices[0])?.deviceId;
        } catch {
          /* device enumeration is best-effort */
        }

        const controls = await reader.decodeFromVideoDevice(
          desiredDevice,
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
        setError(
          "Unable to access the camera. Allow camera permission or use the USB scanner instead.",
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
        <p className="text-sm text-gray-600">
          Point the camera at the product barcode. The item is added to the
          cart automatically when a code is detected.
        </p>

        <div className="relative bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full aspect-video object-cover"
            muted
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