import Time from "../src"

describe("delay", () => {
	it("should trigger after ~1 second", async() =>
	{
		const delay: Time.Delay = Time.delay(1000, undefined, false);

		const call = jest.fn();
		delay.then(() => call());

		expect(call).not.toHaveBeenCalled();

		const start = Date.now();

		delay.start();

		expect(call).not.toHaveBeenCalled();

		await delay;

		const end = Date.now();

		expect(call).toHaveBeenCalled();
		expect(end - start).toBeGreaterThanOrEqual(1000);
	})
})