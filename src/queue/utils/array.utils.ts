export class ArrayUtils {
  static isArray<T>(object: T): boolean {
    return (
      object !== undefined &&
      object != null &&
      object instanceof Array &&
      Array.isArray(object)
    );
  }

  static isEmpty<T>(object: T): boolean {
    // @ts-ignore
    return !ArrayUtils.isArray(object) || object.length <= 0;
  }

  static hasElements<T>(object: T): boolean {
    // @ts-ignore
    return ArrayUtils.isArray(object) && object.length > 0;
  }
}
