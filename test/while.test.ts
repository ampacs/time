import Time from "../src"

describe("while", () => {
	it("should trigger after ~1 second", async() =>
	{
		let isTrue = true;
		const whiler: Time.While = Time.while(() => isTrue, false);

		const call = jest.fn();
		whiler.then(() => call());

		expect(call).not.toHaveBeenCalled();

		const start = Date.now();

		whiler.start();

		expect(call).not.toHaveBeenCalled();

		await Time.delay(1000);
		isTrue = false;

		const end = Date.now();

		expect(call).toHaveBeenCalled();
		expect(end - start).toBeGreaterThanOrEqual(1000);
	})
})