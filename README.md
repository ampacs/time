# Time Utility Library

This library provides a set of utilities for managing intervals, and awaitable delays and conditions in the browser.

It also includes support for setting up a custom time registry for allowing manual management of the update loop of each of the included utilities.

## Usage

### Intervals

Intervals allow you to trigger functionality repeatedly, with a specified time interval in milliseconds. Intervals expose an event to which listeners can be attached, which will be triggered at every specified time interval.

```ts
import Time from 'time';

const interval = Time.interval(1000); // tick every second
interval.onTick.add(time => console.log(`Current time on tick: ${time}`));

// stop the interval to prevent memory leaks
interval.cancel();
```

### Delays

Delays allow you to trigger functionality after a specified time duration in milliseconds.

```ts
import Time from 'time';

// wait for 1 second before proceeding
await Time.delay(1000);
```

### Untils

Untils allow you to trigger functionality when a provided condition is met.

```ts
import Time from 'time';

// wait until condition is met
await Time.until(() => condition === true);
```

### Whiles

Whiles allow you to trigger functionality when a provided condition is no longer being met.

```ts
import Time from 'time';

// wait while condition is being met
await Time.while(() => condition === true);
```

### Registry

The time registry is responsible for internally managing the timing of the time-related utilities.

The default registry is a simple wrapper around the browser's [`setTimeout`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setInterval), [`clearTimeout`](https://developer.mozilla.org/en-US/docs/Web/API/Window/clearTimeout), [`setInterval`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setInterval) and [`clearInterval`](https://developer.mozilla.org/en-US/docs/Web/API/Window/clearInterval).

```ts
import Time from 'time';

// use the default time registry
Time.setRegistry(new Time.Registry.Default);
// or
Time.resetRegistry();
```

An updateable registry is also provided for allowing direct control of how often and when the time-related utilities update.

```ts
import Time from 'time';

// use the updateable time registry 
const registry = new Time.Registry.Updateable(0);

Time.setRegistry(registry);

// inside your update loop
registry.update(16); // update with delta time of 16 milliseconds
```