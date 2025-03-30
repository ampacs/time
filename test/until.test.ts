import Time from "../src"

describe("until", () => {
	it("should trigger after ~1 second", async() =>
	{
		let isTrue = false;
		const until: Time.Until = Time.until(() => isTrue, false);

		const call = jest.fn();
		until.then(() => call());

		expect(call).not.toHaveBeenCalled();

		const start = Date.now();

		until.start();

		expect(call).not.toHaveBeenCalled();

		await Time.delay(1000);
		isTrue = true;

		const end = Date.now();

		expect(call).toHaveBeenCalled();
		expect(end - start).toBeGreaterThanOrEqual(1000);
	})
})