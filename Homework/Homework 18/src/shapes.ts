export interface RectangleInput {
  width: number;
  height: number;
}

export class Rectangle {
  private readonly _width: number;
  private readonly _height: number;

  constructor(width: number, height: number) {
    if (width <= 0 || height <= 0) {
      throw new Error("Rectangle width and height must be positive numbers");
    }
    this._width = width;
    this._height = height;
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  getArea(): number {
    return this._width * this._height;
  }

  getPerimeter(): number {
    return 2 * (this._width + this._height);
  }
}

export function calculateRectangleArea(rectangle: RectangleInput | Rectangle): number {
  if (rectangle instanceof Rectangle) {
    return rectangle.getArea();
  }
  return rectangle.width * rectangle.height;
}

export function calculateRectanglePerimeter(rectangle: RectangleInput | Rectangle): number {
  if (rectangle instanceof Rectangle) {
    return rectangle.getPerimeter();
  }
  return 2 * (rectangle.width + rectangle.height);
}

export interface CircleInput {
  radius: number;
}

export class Circle {
  private readonly _radius: number;

  constructor(radius: number) {
    if (radius <= 0) {
      throw new Error("Circle radius must be a positive number");
    }
    this._radius = radius;
  }

  get radius(): number {
    return this._radius;
  }

  getArea(): number {
    return Math.PI * Math.pow(this._radius, 2);
  }

  getPerimeter(): number {
    return 2 * Math.PI * this._radius;
  }
}

export function calculateCircleArea(circle: CircleInput | Circle): number {
  if (circle instanceof Circle) {
    return circle.getArea();
  }
  return Math.PI * Math.pow(circle.radius, 2);
}

export function calculateCirclePerimeter(circle: CircleInput | Circle): number {
  if (circle instanceof Circle) {
    return circle.getPerimeter();
  }
  return 2 * Math.PI * circle.radius;
}
