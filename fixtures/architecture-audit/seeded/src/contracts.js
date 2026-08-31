import { isCloud } from "./db.js";

export const taskStatuses = isCloud ? ["todo", "done"] : ["todo", "done"];

export function normalizeTask(input) {
  return { title: input.title.trim(), status: input.status ?? "todo" };
}
