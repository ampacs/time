import { Event, IEvent } from "./event";

type Resolver<TResult> = ((value: void) => TResult | PromiseLike<TResult>) | null | undefined;

type Rejecter<TResult = never> = ((reason: unknown) => TResult | PromiseLike<TResult>) | null | undefined;

type Finalizer = (() => void) | null | undefined;

/**
 * Represents an interval that fires an event at every every time interval in milliseconds.
 * 
 * It's goal is to provide a simple and easy-to-use interface for creating and interacting with intervals.
 */
interface IInterval
{
	/**
	 * The event that is fired at every tick of the event loop, each spaced apart by a pre-specified interval in milliseconds.
	 * It contains the current time in milliseconds of the moment the event was fired.
	 */
	readonly onTick: IEvent<number>;

	/**
	 * Starts the interval, if it's not already running.
	 */
	start(): void;
	/**
	 * Stops the interval, if it's running.
	 */
	cancel(): void;
	/**
	 * Stops the interval if it's running and resets the internal time interval to a new one.
	 * 
	 * @param {number} interval - the new interval in milliseconds
	 */
	reset(interval: number): void;
}

class Interval implements IInterval
{
	private readonly _onTick: Event<number> = new Event;
	public readonly onTick: IEvent<number> = this._onTick;

	private _registry: ITimeRegistry;

	private _interval: number;

	private _isStarted: boolean = false;

	private _canceller: () => void;

	public constructor(registry: ITimeRegistry, interval: number, autoStart: boolean)
	{
		this._registry = registry;

		this._interval = Math.max(0, interval);
		this._canceller = () => { return; };

		if (autoStart)
		{
			this.start();
		}
	}

	public start(): void
	{
		if (this._isStarted)
		{
			return;
		}

		this._isStarted = true;

		const intervalId = this._registry.setInterval(() => this._onTick.fire(this._registry.now()), this._interval);
		this._canceller = () =>
		{
			this._registry.clearInterval(intervalId);
			this._canceller = () => { return; };
		};
	}

	public cancel(): void
	{
		this._canceller();

		this._isStarted = false;
	}

	public reset(interval: number): void
	{
		this.cancel();

		this._interval = Math.max(0, interval);
	}
}

/**
 * Represents a delay as a promise that resolves after a time duration in milliseconds.
 * 
 * It's goal is to provide a simple and easy-to-use interface for creating and interacting with timeouts.
 */
interface IDelay extends Promise<void>
{
	/**
	 * Starts the delay, if it's not already running.
	 * 
	 * @returns a promise that resolves when the delay finishes
	 */
	start(): Promise<void>;
	/**
	 * Cancels the delay, if it's running.
	 * 
	 * If the delay is cancelled, the (underlying) promise will never resolve.
	 * It will instead be rejected, unless configured to not do so.
	 */
	cancel(): void;
	/**
	 * Cancels the delay and resets the internal time duration to a new one.
	 * 
	 * @param {number} duration - the new duration in milliseconds
	 */
	reset(duration: number): void;
}

class Delay implements IDelay
{
	public get [Symbol.toStringTag](): string
	{
		return `Promise<delay: ${this._duration}ms>`;
	}

	private _registry: ITimeRegistry;

	private _promise: Promise<void>;
	private _resolver: () => void;
	private _rejecter: (reason: unknown) => void;

	private _canceller: () => void;

	private _duration: number;
	private _rejectOnCancel: boolean;

	private _isStarted: boolean;
	private _isInitialized: boolean;

	public constructor(registry: ITimeRegistry, duration: number, rejectOnCancel: boolean, autoStart: boolean)
	{
		this._registry = registry;

		this._duration = Math.max(0, duration);
		this._rejectOnCancel = rejectOnCancel;

		this._isStarted = false;

		[this._promise, this._resolver, this._rejecter] = this._createPromise();
		this._canceller = this._createCanceler();

		this._isInitialized = true;

		if (autoStart)
		{
			this.start();
		}
	}

	public then<TResult = void>(onfulfilled?: Resolver<TResult>, onrejected?: Rejecter): Promise<TResult | never>
	{
		return this._promise.then(onfulfilled, onrejected);
	}

	public catch(onrejected?: Rejecter): Promise<void | never>
	{
		return this._promise.catch(onrejected);
	}

	public finally(onfinally?: Finalizer): Promise<void>
	{
		return this._promise.finally(onfinally);
	}

	public start(): Promise<void>
	{
		if (this._isStarted)
		{
			return this;
		}

		if (!this._isInitialized)
		{
			[this._promise, this._resolver, this._rejecter] = this._createPromise();

			this._isInitialized = true;
		}

		const timeoutId = this._registry.setTimeout(() =>
		{
			this._isStarted = false;
			this._isInitialized = false;

			this._canceller = this._createCanceler();

			this._resolver();
		}, this._duration);

		this._canceller = this._createCanceler(timeoutId, this._rejecter);

		return this;
	}

	public cancel(): void
	{
		this._canceller();
	}

	public reset(duration: number): void
	{
		this.cancel();

		this._duration = Math.max(0, duration);
	}

	private _createPromise(): [Promise<void>, () => void, (reason: unknown) => void]
	{
		let resolver: () => void;
		let rejecter: (reason: unknown) => void;
		const promise = new Promise<void>((resolve, reject) =>
		{
			resolver = resolve;
			rejecter = reject;
		});

		return [promise, resolver!, rejecter!];
	}

	private _createCanceler(): () => void
	private _createCanceler(timeoutId: number, rejecter: (reason: unknown) => void): () => void
	private _createCanceler(timeoutId?: number, rejecter?: (reason: unknown) => void): () => void
	{
		if (!timeoutId || !rejecter)
		{
			return () => { return; };
		}

		return () =>
		{
			if (this._rejectOnCancel)
			{
				rejecter(new Error("cancelled"));
			}

			this._registry.clearTimeout(timeoutId);
			this._canceller = () => { return; };

			this._isStarted = false;
			this._isInitialized = false;
		};
	}
}

/**
 * Represents a condition as a promise that is checked at the end of every tick of the event loop.
 * 
 * It allows waiting for a condition to be satisfied before continuing execution.
 */
interface IUntil extends Promise<void>
{
	/**
	 * Starts the condition, if it's not already running.
	 * 
	 * @returns a promise that resolves when the condition is satisfied
	 */
	start(): Promise<void>;
}

class Until implements IUntil
{
	public get [Symbol.toStringTag](): string
	{
		return "Promise<until>";
	}

	private _registry: ITimeRegistry;

	private _promise: Promise<void>;

	private _condition: () => boolean;
	private _isStarted: boolean = false;

	public constructor(registry: ITimeRegistry, condition: () => boolean, autoStart: boolean)
	{
		this._registry = registry;

		this._condition = condition;
		this._promise = Promise.resolve();

		if (autoStart)
		{
			this.start();
		}
	}

	public then<TResult = void>(onfulfilled?: Resolver<TResult>, onrejected?: Rejecter): Promise<TResult | never>
	{
		return this._promise.then(onfulfilled, onrejected);
	}

	public catch(onrejected?: Rejecter): Promise<void | never>
	{
		return this._promise.catch(onrejected);
	}

	public finally(onfinally?: Finalizer): Promise<void>
	{
		return this._promise.finally(onfinally);
	}

	public start(): Promise<void>
	{
		if (this._isStarted)
		{
			return this;
		}

		this._isStarted = true;

		let resolver: () => void;
		this._promise = new Promise(resolve =>
		{
			resolver = resolve;
		});

		// check if the condition has been satisfied
		// at the end of every tick of the event loop
		const intervalId = this._registry.setInterval(() =>
		{
			// if the condition callback returns true
			if (this._condition())
			{
				resolver();

				this._registry.clearInterval(intervalId);

				// clear the reference to the condition callback
				this._condition = undefined as unknown as () => boolean;
			}
		}, 0);

		return this;
	}
}

/**
 * Represents a registry that manages intervals and timeouts.
 * 
 * It provides methods for creating and managing intervals and timeouts,
 * as well as for getting the current internal registry time in milliseconds.
 */
interface ITimeRegistry
{
	/**
	 * Returns the current registry time in milliseconds.
	 * 
	 * @returns {number} the current time in milliseconds
	 */
	now(): number;

	/**
	 * Creates an interval that fires a {@link handler} function at every
	 * {@link interval} milliseconds with the provided {@link args}.
	 * 
	 * The first execution happens after {@link interval} milliseconds. Defaults
	 * to 0 milliseconds if not specified, or if it's a negative number. This
	 * will cause the handler to be executed "immediately"
	 * after the current event loop.
	 * 
	 * Returns the interval ID that can be used to clear the interval.
	 * 
	 * @param {F} handler the function to execute at every {@link interval} milliseconds
	 * @param {number} [interval] the time interval between executions in milliseconds
	 * @param {Parameters<F>} args the arguments to pass to the handler
	 * @returns {number} the ID of the interval
	 */
	setInterval<F extends (...args: readonly any[]) => any>(handler: F, interval?: number, ...args: Parameters<F>): number;
	/**
	 * Clears the interval with the provided {@link id}.
	 * 
	 * @param {number} id the ID of the interval to clear
	 */
	clearInterval(id: number): void;

	/**
	 * Creates a timeout that fires a {@link handler} function after
	 * {@link delay} milliseconds with the provided {@link args}.
	 * 
	 * The {@link delay} defaults to 0 milliseconds if not specified,
	 * or if it's a negative number. This will cause the handler to be
	 * executed "immediately" after the current event loop.
	 * 
	 * Returns the timeout ID that can be used to clear the timeout.
	 * 
	 * @param {F} handler a function handler to be executed after {@link delay} milliseconds have passed
	 * @param {number} [delay] the time delay in milliseconds that'll pass before the handler is executed
	 * @param {Parameters<F>} args the arguments to pass to the handler
	 */
	setTimeout<F extends (...args: readonly any[]) => any>(handler: F, delay?: number, ...args: Parameters<F>): number;
	/**
	 * Clears the timeout with the provided {@link timeoutId}.
	 * 
	 * @param {number} id the ID of timeout to clear
	 */
	clearTimeout(id: number): void;
}

class TimeRegistry implements ITimeRegistry
{
	public now(): number
	{
		return Date.now();
	}

	public setInterval<F extends (...args: readonly any[]) => any>(handler: F, interval?: number, ...args: Parameters<F>): number
	{
		return setInterval(handler, interval, ...args);
	}

	public clearInterval(id: number): void
	{
		clearInterval(id);
	}

	public setTimeout<F extends (...args: readonly any[]) => any>(handler: F, delay?: number, ...args: Parameters<F>): number
	{
		return setTimeout(handler, delay, ...args);
	}

	public clearTimeout(id: number): void
	{
		clearTimeout(id);
	}
}

type TimeoutHandler = {
	handler: Function;
	args: unknown[];
	allowedExecutionTime: number;
};

type IntervalHandler = TimeoutHandler & {
	interval: number;
};

/**
 * Represents a registry that manages intervals and timeouts. It allows
 * updating the registry time manually, which is required for the {@link Time.Interval},
 * {@link Time.Delay} and {@link Time.Until} instances to work correctly.
 * 
 * The most common use case for this registry is in a game loop, where the
 * registry time is updated at every tick of the game loop.
 */
class UpdateableTimeRegistry implements ITimeRegistry
{
	private readonly _intervals: Map<number, IntervalHandler> = new Map;
	private readonly _timeouts: Map<number, TimeoutHandler> = new Map;

	private _currentId: number = Number.MIN_SAFE_INTEGER;

	private _lastTime: number;

	/**
	 * Creates a new registry with the specified start time in milliseconds.
	 * 
	 * @param {number} startTime the initial time in milliseconds
	 */
	public constructor(startTime: number)
	{
		this._lastTime = startTime;
	}

	/**
	 * Updates the registry time with the provided delta time in milliseconds.
	 * 
	 * @param {number} delta the delta time in milliseconds
	 */
	public update(delta: number): void
	{
		const currentTime = this._lastTime + delta;

		for (const [_, interval] of this._intervals)
		{
			if (currentTime >= interval.allowedExecutionTime)
			{
				interval.handler(...interval.args);

				interval.allowedExecutionTime = currentTime + interval.interval;
			}
		}

		for (const [id, timeout] of this._timeouts)
		{
			if (currentTime >= timeout.allowedExecutionTime)
			{
				timeout.handler(...timeout.args);

				this.clearTimeout(id);
			}
		}

		this._lastTime = currentTime;
	}

	public now(): number
	{
		return this._lastTime;
	}

	public setInterval<F extends (...args: readonly any[]) => any>(handler: F, interval?: number, ...args: Parameters<F>): number
	{
		const id = this._generateId();

		interval = interval ? Math.max(interval, 0) : 0;

		this._intervals.set(id, {
			handler,
			args,
			interval,
			allowedExecutionTime: this._lastTime + interval
		});

		return id;
	}

	public clearInterval(id: number): void
	{
		this._intervals.delete(id);
	}

	public setTimeout<F extends (...args: readonly any[]) => any>(handler: F, delay?: number, ...args: Parameters<F>): number
	{
		const id = this._generateId();

		delay = delay ? Math.max(delay, 0) : 0;

		this._timeouts.set(id, {
			handler,
			args,
			allowedExecutionTime: this._lastTime + delay
		});

		return id;
	}

	public clearTimeout(id: number): void
	{
		this._timeouts.delete(id);
	}

	private _generateId(): number
	{
		const id = this._currentId++;

		// this means that there can't be no more than 18,014,398,509,481,981
		// intervals and timeouts running simultaneously before issues
		// start arising due to ID collisions;
		// however, the browser or server environment will probably
		// commit seppuku before this amount is ever reached
		if (this._currentId === Number.MAX_SAFE_INTEGER)
		{
			this._currentId = Number.MIN_SAFE_INTEGER;
		}

		return id;
	}
}

/**
 * {@link Time} is a utility class that provides a set of methods for easier creation and interaction with intervals, timeouts and awaitable conditions.
 */
class TimeController
{
	public static readonly Registry = class {
		public static readonly Default = TimeRegistry;
		public static readonly Updateable = UpdateableTimeRegistry;
	}

	/**
	 * The time registry that is used to manage intervals and timeouts.
	 *
	 * It is used internally by the created {@link Time.Interval}, {@link Time.Delay}
	 * and {@link Time.Until} instances.
	 *
	 * By default, it uses the default registry {@link Time.Registry}, which
	 * manages intervals and timeouts using the built-in {@link setInterval}
	 * and {@link setTimeout} functions.
	 */
	public static get registry(): Time.Registry { return this._registry; }

	private static _registry: Time.Registry = new TimeRegistry;

	private constructor() { /* disallow instantiation */ }

	/**
	 * Sets the time registry to be used by the (new) created
	 * {@link Time.Interval}, {@link Time.Delay} and {@link Time.Until} instances.
	 *
	 * @param {Time.Registry} registry the registry to use
	 */
	public static setRegistry(registry: Time.Registry): void
	{
		this._registry = registry;
	}

	/**
	 * Resets the time registry to the default registry, {@link Time.Registry.Default}.
	 *
	 * The default registry manages intervals and timeouts using the built-in
	 * {@link setInterval} and {@link setTimeout} functions.
	 */
	public static resetRegistry(): void
	{
		this.setRegistry(new TimeRegistry);
	}

	/**
	 * Creates an interval that fires an `onTick` {@link Event} at every `interval` milliseconds.
	 * 
	 * Example usage:
	 * ```typescript
	 * const interval = Time.interval(1000); // tick every second
	 * interval.onTick.addListener(time => console.log(`current time on tick: ${time}`));
	 * ```
	 * Stopping the interval is necessary to prevent memory leaks:
	 * ```typescript
	 * interval.stop();
	 * ```
	 * 
	 * @param {number} interval the interval in milliseconds. Should be greater than or equal to 0.
	 * @param {boolean} [autoStart=true] whether to start the interval immediately. Defaults to `true`.
	 * @returns {TimeInterval} a new interval as an {@link Time.Interval}
	 */
	public static interval(interval: number, autoStart: boolean = true): Time.Interval
	{
		return new Interval(this._registry, interval, autoStart);
	}

	/**
	 * Creates an awaitable delay as a {@link Promise<void>} that resolves after `duration` milliseconds.
	 * 
	 * Example usage:
	 * ```typescript
	 * await Time.delay(1000); // wait for 1 second before proceeding
	 * ```
	 * 
	 * @param {number} duration the duration in milliseconds. Should be greater than or equal to 0.
	 * @param {boolean} [rejectOnCancel=true] whether to reject the promise if the delay is cancelled. Even if `false`, the promise will not resolve if cancelled. Defaults to `true`.
	 * @param {boolean} [autoStart=true] whether to start the delay immediately. Defaults to `true`.
	 * @returns {Time.Delay} a new delay as an {@link Time.Delay}
	 */
	public static delay(duration: number, rejectOnCancel: boolean = true, autoStart: boolean = true): Time.Delay
	{
		return new Delay(this._registry, duration, rejectOnCancel, autoStart);
	}

	/**
	 * Creates an awaitable condition as a {@link Promise<void>} that resolves when `callback` returns `true`. The condition is checked at the end of every tick of the event loop.
	 * 
	 * Example usage:
	 * ```typescript
	 * // wait for `condition` to become `true`
	 * await Time.until(() => condition === true)
	 * ```
	 * 
	 * @param {() => boolean} condition the condition to check for as a callback that returns a boolean.
	 * @param {boolean} [autoStart=true] whether to start the condition check immediately. Defaults to `true`.
	 * @returns {Time.Until} a new condition as an {@link Time.Until}
	 */
	public static until(condition: () => boolean, autoStart: boolean = true): Time.Until
	{
		return new Until(this._registry, condition, autoStart);
	}

	/**
	 * Creates an awaitable condition as a {@link Promise<void>} that resolves when `callback` returns `false`. The condition is checked at the end of every tick of the event loop.
	 * 
	 * Example usage:
	 * ```typescript
	 * // wait while `condition` is `true`
	 * await Time.while(() => condition === true)
	 * ```
	 * 
	 * @param {() => boolean} condition the condition to check for as a callback that returns a boolean.
	 * @param {boolean} [autoRestart=true] whether to restart the condition check automatically after the promise resolves. If `true`, the promise is recreated after all `then` and `catch` callbacks, but before any `finally` callbacks. Defaults to `true`.
	 * @param {boolean} [autoStart=true] whether to start the condition check immediately. Defaults to `true`.
	 * @returns {Time.While} a new condition as an {@link Time.While}
	 */
	public static while(condition: () => boolean, autoStart: boolean = true): Time.While
	{
		return new Until(this._registry, () => !condition(), autoStart);
	}
}

export const Time = TimeController;
export namespace Time
{
	export namespace Registry
	{
		export type Default = TimeRegistry;
		export type Updateable = UpdateableTimeRegistry;
	}

	export type Registry = ITimeRegistry;

	export type Delay = IDelay;
	export type Interval = IInterval
	export type Until = IUntil;
	export type While = IUntil;
}
export default Time;
