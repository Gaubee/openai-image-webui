// Run: node scripts/check-task-groups.ts
import { groupTasks } from "../src/lib/taskGroups.ts";
import type { ImageTask } from "../src/types/index.ts";

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : `\n     got ${JSON.stringify(actual)}\n     want ${JSON.stringify(expected)}`}`);
  if (!ok) process.exitCode = 1;
}

const task = (id: string, createdAt: number, groupId?: string) =>
  ({ id, createdAt, groupId, prompt: "", model: "", size: "", mode: "generate", responseFormat: "url", status: "success" }) as ImageTask;

const tasks = [
  task("legacy", 1),
  task("a1", 10, "A"),
  task("a2", 11, "A"),
  task("b1", 20, "B"),
  task("a3", 30, "A"), // retried later: createdAt reset
];
const ids = (groups: ImageTask[][]) => groups.map((group) => group.map((t) => t.id));

const all = groupTasks(tasks, 100);
check("newest group first, submission order kept inside a group", ids(all.groups), [["a1", "a2", "a3"], ["b1"], ["legacy"]]);
check("nothing hidden under the limit", all.hiddenCount, 0);

const limited = groupTasks(tasks, 3);
check("limit keeps whole groups", ids(limited.groups), [["a1", "a2", "a3"]]);
check("hidden count covers the cut groups", limited.hiddenCount, 2);
