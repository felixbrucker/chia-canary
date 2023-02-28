interface CachedValue<T> {
  timeoutTimer: NodeJS.Timer
  value: T
}

export class TtlCache {
  private readonly cachedValues: Map<string, CachedValue<unknown>> = new Map<string, CachedValue<unknown>>()

  public constructor(private readonly ttlInSeconds: number) {}

  public get<Value>(key: string): Value | undefined {
    return this.cachedValues.get(key)?.value as Value
  }

  public set(key: string, value: any) {
    const existingValue = this.cachedValues.get(key)
    if (existingValue !== undefined) {
      clearTimeout(existingValue.timeoutTimer)
    }
    this.cachedValues.set(key, {
      timeoutTimer: setTimeout(() => this.cachedValues.delete(key), this.ttlInSeconds * 1000),
      value,
    })
  }

  public delete(key: string) {
    const existingValue = this.cachedValues.get(key)
    if (existingValue === undefined) {
      return
    }
    clearTimeout(existingValue.timeoutTimer)
    this.cachedValues.delete(key)
  }
}
