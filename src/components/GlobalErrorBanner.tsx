"use client";

import { AlertCircle, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type AlertTone = "error" | "warning" | "success" | "info";

export interface GlobalAlert {
  tone: AlertTone;
  message: string;
  title?: string;
}

export interface ConfirmationPrompt {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface GlobalErrorBannerProps {
  alert?: GlobalAlert | null;
  onDismissAlert?: () => void;
  confirmation?: ConfirmationPrompt | null;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

const alertIcons = {
  error: AlertCircle,
  warning: TriangleAlert,
  success: CircleCheck,
  info: Info,
} satisfies Record<AlertTone, typeof Info>;

export default function GlobalErrorBanner({
  alert,
  onDismissAlert,
  confirmation,
  onConfirm,
  onCancel,
}: GlobalErrorBannerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (confirmation && !dialog.open) {
      dialog.showModal();
      confirmButtonRef.current?.focus();
    } else if (!confirmation && dialog.open) {
      dialog.close();
      setConfirmationError(null);
    }
  }, [confirmation]);

  const Icon = alert ? alertIcons[alert.tone] : null;

  async function confirmAction() {
    if (!onConfirm || confirming) return;

    setConfirming(true);
    setConfirmationError(null);
    try {
      await onConfirm();
    } catch {
      setConfirmationError("The action could not be completed. Please try again.");
    } finally {
      setConfirming(false);
    }
  }

  function cancelAction() {
    setConfirmationError(null);
    if (onCancel) {
      onCancel();
    } else {
      dialogRef.current?.close();
    }
  }

  return (
    <>
      {alert && Icon ? (
        <aside
          className={`global-alert global-alert--${alert.tone}`}
          role={alert.tone === "error" || alert.tone === "warning" ? "alert" : "status"}
          aria-live={alert.tone === "error" || alert.tone === "warning" ? "assertive" : "polite"}
        >
          <Icon className="global-alert__icon" aria-hidden="true" size={21} />
          <div className="global-alert__content">
            {alert.title ? <strong className="global-alert__title">{alert.title}</strong> : null}
            <p>{alert.message}</p>
          </div>
          {onDismissAlert ? (
            <button
              className="global-alert__dismiss"
              type="button"
              onClick={onDismissAlert}
              aria-label="Dismiss alert"
            >
              <X aria-hidden="true" size={18} />
            </button>
          ) : null}
        </aside>
      ) : null}

      <dialog
        ref={dialogRef}
        className="confirmation-dialog"
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-message"
        onCancel={(event) => {
          event.preventDefault();
          cancelAction();
        }}
      >
        {confirmation ? (
          <div className="confirmation-dialog__content">
            <h2 id="confirmation-dialog-title">{confirmation.title}</h2>
            <p id="confirmation-dialog-message">{confirmation.message}</p>
            {confirmationError ? (
              <p className="confirmation-dialog__error" role="alert">
                {confirmationError}
              </p>
            ) : null}
            <div className="confirmation-dialog__actions">
              <button
                className="button button--secondary"
                type="button"
                onClick={cancelAction}
                disabled={confirming}
              >
                {confirmation.cancelLabel ?? "Cancel"}
              </button>
              <button
                ref={confirmButtonRef}
                className={`button ${confirmation.destructive ? "button--danger" : "button--primary"}`}
                type="button"
                onClick={confirmAction}
                disabled={confirming || !onConfirm}
              >
                {confirming ? "Please wait…" : (confirmation.confirmLabel ?? "Confirm")}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
