export interface EventListener<T>
{
	(value: T): void;
}

export interface IEvent<T = void>
{
	add(listener: EventListener<T>): void;
	remove(listener: EventListener<T>): void;
}

export class Event<T = void> implements IEvent<T>
{
	private _listeners: EventListener<T>[] = [];

	public add(listener: EventListener<T>): void
	{
		this._listeners.push(listener);
	}

	public remove(listener: EventListener<T>): void
	{
		if (this._listeners.length == 0)
		{
			return;
		}

		const index = this._listeners.findIndex(l => l === listener);
		if (index === -1)
		{
			return;
		}

		this._listeners.splice(index, 1);
	}

	public fire(value: T): void
	{
		// create a copy of the listeners array before invoking them
		// to prevent issues related to updating it mid-event
		const listeners = this._listeners.slice();

		for (const listener of listeners)
		{
			listener(value);
		}
	}
}
