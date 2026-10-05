/*
 * Intent: Inline result gallery with motion layout animations (2026-10-05)
 * Replaces TaskQueue for Generate mode - results appear directly below prompt
 */

import { motion, AnimatePresence } from "motion/react";
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ImageTask } from "../types/index";
import { TaskCard } from "./TaskCard";

interface ResultGalleryProps {
  id?: string;
  tasks: ImageTask[];
  onPreview: (imageUrl: string) => void;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onClearTaskImage: (id: string) => void;
  onReuseParams: (task: ImageTask) => void;
}

export const ResultGallery = memo(function ResultGallery({
  id,
  tasks,
  onPreview,
  onRetry,
  onCancel,
  onRemove,
  onClearTaskImage,
  onReuseParams,
}: ResultGalleryProps) {
  const { t } = useTranslation();

  // Only show most recent 20 tasks inline (memory point: recent results visible)
  const visibleTasks = useMemo(() => {
    return [...tasks]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20);
  }, [tasks]);

  if (visibleTasks.length === 0) {
    return null;
  }

  return (
    <div id={id} className="space-y-3">
      <AnimatePresence mode="popLayout">
        {visibleTasks.map((task) => (
          <motion.div
            key={task.id}
            layout
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <TaskCard
              task={task}
              onPreview={onPreview}
              onRetry={onRetry}
              onCancel={onCancel}
              onRemove={onRemove}
              onClearImage={onClearTaskImage}
              onReuseParams={onReuseParams}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});
