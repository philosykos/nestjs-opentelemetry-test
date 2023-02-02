export class CommonUtils {
  static isNull<T>(value: T): boolean {
    return value === undefined || value == null;
  }

  static isValid<T>(object: T): boolean {
    return object !== undefined && object != null;
  }

  static getValueOrDefault<T>(value: T, defaultValue: T = null): T {
    return value !== undefined && value != null ? value : defaultValue;
  }
}
