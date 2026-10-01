import type { ImageTask } from "../types";

/**
 * Groups tasks submitted together, newest group first. Inside a group tasks keep
 * submission order (retries reset `createdAt`, so it can't be used there).
 * Whole groups are kept until `maxTasks` tasks are shown.
 */
export function groupTasks(tasks: ImageTask[], maxTasks: number) {
  const byKey = new Map<string, ImageTask[]>();
  for (const task of tasks) {
    const key = task.groupId ?? task.id;
    const group = byKey.get(key);
    if (group) {
      group.push(task);
    } else {
      byKey.set(key, [task]);
    }
  }

  const ordered = [...byKey.values()]
    .map((group) => ({ group, latest: Math.max(...group.map((task) => task.createdAt)) }))
    .sort((a, b) => b.latest - a.latest);

  const groups: ImageTask[][] = [];
  let shown = 0;
  for (const { group } of ordered) {
    if (shown >= maxTasks) break;
    groups.push(group);
    shown += group.length;
  }

  return { groups, hiddenCount: tasks.length - shown };
}
