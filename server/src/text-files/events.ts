export interface Listener<T> {
  (event: T): any;
}

export interface Disposable {
  dispose(): void;
}

export interface Events<T> {
  do(listener: Listener<T>): Disposable;
  doOnce(listener: Listener<T>): void;
  done(listener: Listener<T>): void;
}

export class Emitter<T> implements Events<T> {
  private listeners: Listener<T>[] = [];
  private onceListeners: Listener<T>[] = [];

  do = (listener: Listener<T>): Disposable => {
    this.listeners.push(listener);
    return {
      dispose: () => this.done(listener)
    };
  };

  doOnce = (listener: Listener<T>): void => {
    this.onceListeners.push(listener);
  };

  done = (listener: Listener<T>): void => {
    const callbackIndex = this.listeners.indexOf(listener);
    if (callbackIndex > -1) this.listeners.splice(callbackIndex, 1);
  };

  emit = (event: T) => {
    /** Update any general listeners */
    this.listeners.forEach((listener) => listener(event));

    /** Clear the `once` queue */
    if (this.onceListeners.length > 0) {
      const toCall = this.onceListeners;
      this.onceListeners = [];
      toCall.forEach((listener) => listener(event));
    }
  };
}
