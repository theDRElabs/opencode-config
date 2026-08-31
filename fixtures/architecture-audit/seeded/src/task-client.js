export function saveTask(http, task) {
  return http.post("/tasks", task);
}
