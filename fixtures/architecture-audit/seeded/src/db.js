import { normalizeTask } from "./contracts.js";

export let connection;
export const isCloud = Boolean(process.env.CLOUD);

export function getConnection() {
  connection ??= { rows: [] };
  return connection;
}

export function createTask(input) {
  const task = normalizeTask(input);
  getConnection().rows.push(task);
  return task;
}

export function sendTaskCreated(task, mailer) {
  return mailer.send(`created:${task.title}`);
}
