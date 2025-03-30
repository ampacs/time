import Time from "../src"

describe("interval", () => {
	it("should trigger 2 times in ~1 second", async() =>
	{
		const interval: Time.Interval = Time.interval(500, false);

		const call = jest.fn();
		interval.onTick.add(call);
		expect(call).not.toHaveBeenCalled();

		const start = Date.now();

		interval.start();
		expect(call).not.toHaveBeenCalled();

		const delayTime = 1100; // extra buffer time
		await Time.delay(delayTime)

		const end = Date.now();

		expect(call).toHaveBeenCalledTimes(2);
		expect(end - start).toBeGreaterThanOrEqual(delayTime);
	})
})