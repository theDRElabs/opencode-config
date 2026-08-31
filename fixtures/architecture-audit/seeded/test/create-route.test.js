import { post } from "../src/create-route.js";

test("creates", async () => {
  const request = { json: vi.fn().mockResolvedValue({ title: " A " }) };
  const mailer = { send: vi.fn().mockResolvedValue(true) };
  const result = await post(request, mailer);
  expect(request.json).toHaveBeenCalled();
  expect(mailer.send).toHaveBeenCalled();
  expect(result).toBeTruthy();
});
