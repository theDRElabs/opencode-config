import { createTask, sendTaskCreated } from "./db.js";

export async function importOne(body, mailer) {
  if (!body.title) return { status: 422 };
  const task = createTask(body);
  await sendTaskCreated(task, mailer);
  return { status: 201, task };
}
