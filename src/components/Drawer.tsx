/*
 * Intent: Slide-in drawer container for secondary panels (2026-10-05)
 * Slides from right with motion, backdrop, explicit close, ESC key support
 */

import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Drawer({ open, onClose, title, children }: DrawerProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto bg-surface-1 shadow-soft focus:outline-none"
            tabIndex={-1}
          >
            {/* Header */}
            {title && (
              <header className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-3 bg-surface-1 px-6 py-4">
                <h2 className="text-heading font-semibold text-text-primary">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded p-1 text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
                  aria-label={t("common.close")}
                >
                  <X className="h-5 w-5" />
                </button>
              </header>
            )}

            {/* Content */}
            <div className="p-6">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
