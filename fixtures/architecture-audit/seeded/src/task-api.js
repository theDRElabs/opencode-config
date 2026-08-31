import { saveTask } from "./task-client.js";

export function createTaskApi(http, task) {
  return saveTask(http, task);
}
