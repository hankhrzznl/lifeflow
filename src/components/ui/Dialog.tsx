"use client";

import { useRef, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  type: "confirm" | "info" | "input";
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  variant?: "default" | "danger";
  inputPlaceholder?: string;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  inputValidate?: (value: string) => string | null;
  children?: ReactNode;
}

const panelAnimation = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 10 },
};

export default function Dialog({
  open,
  onClose,
  type,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  onConfirm,
  onCancel,
  variant = "default",
  inputPlaceholder,
  inputValue: externalInputValue = "",
  onInputChange,
  inputValidate,
  children,
}: DialogProps) {
  const [internalInputValue, setInternalInputValue] = useState(externalInputValue);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isControlled = onInputChange !== undefined;
  const currentInputValue = isControlled ? externalInputValue : internalInputValue;

  useEffect(() => {
    if (externalInputValue !== undefined) {
      setInternalInputValue(externalInputValue);
    }
  }, [externalInputValue]);

  const handleInputChange = (value: string) => {
    if (isControlled) {
      onInputChange!(value);
    } else {
      setInternalInputValue(value);
    }
    if (validationError) {
      setValidationError(null);
    }
  };

  const handleConfirm = () => {
    if (type === "input" && inputValidate) {
      const error = inputValidate(currentInputValue);
      if (error) {
        setValidationError(error);
        inputRef.current?.focus();
        return;
      }
    }
    onConfirm?.();
  };

  const handleCancel = () => {
    onCancel?.();
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const isDanger = variant === "danger";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleBackdropClick}
        >
          <motion.div
            {...panelAnimation}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="max-w-md w-[calc(100%-32px)] bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {isDanger && (
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            )}

            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 text-center">
              {title}
            </h2>

            {description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center">
                {description}
              </p>
            )}

            {type === "input" && (
              <div className="mt-4">
                <input
                  ref={inputRef}
                  type="text"
                  value={currentInputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder={inputPlaceholder}
                  className={`w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
                    validationError
                      ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                />
                {validationError && (
                  <p className="text-sm text-red-500 mt-1.5">{validationError}</p>
                )}
              </div>
            )}

            {children && <div className="mt-4">{children}</div>}

            <div className={`flex gap-3 ${type === "info" ? "justify-center" : "justify-end"} mt-6`}>
              {type === "info" ? (
                <button
                  onClick={onClose}
                  className="bg-indigo-600 text-white rounded-xl h-11 px-5 font-medium hover:bg-indigo-700 transition-colors"
                >
                  知道了
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancel}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl h-11 px-5 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    {cancelLabel}
                  </button>
                  <button
                    onClick={handleConfirm}
                    className={`rounded-xl h-11 px-5 font-medium text-white transition-colors ${
                      isDanger
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                  >
                    {confirmLabel}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
