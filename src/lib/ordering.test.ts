import { describe, expect, it } from "vitest";
import {
  asOrder,
  compareOrder,
  ORDER_STEP,
  orderBetween,
  planMove,
  planStep,
  sortByOrder,
  type Ordered,
} from "./ordering";

const seq = (...orders: (number | undefined)[]): Ordered[] =>
  orders.map((order, i) => ({ id: String.fromCharCode(97 + i), order }));

/** Applies planned positions and returns the ids in their new order. */
const apply = (sequence: Ordered[], changes: Record<string, number>, extra: Ordered[] = []) =>
  [...sequence, ...extra]
    .map((x) => ({ ...x, order: changes[x.id] ?? x.order }))
    .sort((a, b) => a.order! - b.order!)
    .map((x) => x.id)
    .join("");

describe("orderBetween", () => {
  it("picks the midpoint, or steps past an open end", () => {
    expect(orderBetween(1, 3)).toBe(2);
    expect(orderBetween(undefined, 10)).toBe(10 - ORDER_STEP);
    expect(orderBetween(10, undefined)).toBe(10 + ORDER_STEP);
    expect(orderBetween()).toBe(ORDER_STEP);
  });

  it("returns null when nothing fits between", () => {
    expect(orderBetween(1, 1)).toBeNull();
    expect(orderBetween(3, 1)).toBeNull();
    expect(orderBetween(1, 1 + Number.EPSILON)).toBeNull();
  });
});

describe("planMove", () => {
  const list = seq(1, 2, 3, 4);

  it("rewrites only the moved record when its neighbours have positions", () => {
    expect(planMove(list, list[0], 2)).toEqual({ a: 2.5 });
    expect(apply(list, planMove(list, list[0], 2))).toBe("bacd");
    expect(planMove(list, list[3], 0)).toEqual({ d: 1 - ORDER_STEP });
    expect(apply(list, planMove(list, list[3], 0))).toBe("dabc");
    expect(apply(list, planMove(list, list[1], 4))).toBe("acdb");
  });

  it("does nothing when the record stays where it is", () => {
    expect(planMove(list, list[1], 1)).toEqual({});
    expect(planMove(list, list[1], 2)).toEqual({});
  });

  it("moves a record in from another group", () => {
    const incoming = { id: "z", order: 99 };
    expect(planMove(list, incoming, 1)).toEqual({ z: 1.5 });
    expect(planMove([], incoming, 0)).toEqual({ z: ORDER_STEP });
  });

  it("renumbers the group when a neighbour has no position", () => {
    const mixed = seq(undefined, undefined, 5);
    const changes = planMove(mixed, mixed[2], 1);
    expect(changes).toEqual({ a: ORDER_STEP, c: 2 * ORDER_STEP, b: 3 * ORDER_STEP });
    expect(apply(mixed, changes)).toBe("acb");
  });

  it("renumbers when the gap has run out of precision and skips unchanged records", () => {
    const tight = seq(ORDER_STEP, ORDER_STEP, 3 * ORDER_STEP);
    const changes = planMove(tight, tight[2], 1);
    expect(changes).toEqual({ c: 2 * ORDER_STEP, b: 3 * ORDER_STEP });
    expect(apply(tight, changes)).toBe("acb");
  });

  it("clamps the target index", () => {
    expect(apply(list, planMove(list, list[0], 99))).toBe("bcda");
  });
});

describe("planStep", () => {
  const list = seq(1, 2, 3);

  it("moves one place up or down", () => {
    expect(apply(list, planStep(list, "b", -1))).toBe("bac");
    expect(apply(list, planStep(list, "b", 1))).toBe("acb");
  });

  it("does nothing at the ends or for unknown ids", () => {
    expect(planStep(list, "a", -1)).toEqual({});
    expect(planStep(list, "c", 1)).toEqual({});
    expect(planStep(list, "x", 1)).toEqual({});
  });
});

describe("compareOrder and sortByOrder", () => {
  const rec = (id: string, createdAt: number, order?: number) => ({ id, createdAt, order });

  it("puts unpositioned records first, newest first", () => {
    const records = [rec("old", 1), rec("p2", 0, 20), rec("new", 2), rec("p1", 0, 10)];
    const ids = [...records].sort((a, b) => compareOrder(a, b, "first")).map((r) => r.id);
    expect(ids).toEqual(["new", "old", "p1", "p2"]);
  });

  it("puts unpositioned records last in their incoming order", () => {
    const records = [rec("x", 5), rec("p2", 0, 20), rec("y", 1), rec("p1", 0, 10)];
    expect(sortByOrder(records).map((r) => r.id)).toEqual(["p1", "p2", "x", "y"]);
  });

  it("accepts only finite numbers from untrusted data", () => {
    expect(asOrder(1.5)).toBe(1.5);
    expect(asOrder(-3)).toBe(-3);
    expect(asOrder(Number.NaN)).toBeNull();
    expect(asOrder(Infinity)).toBeNull();
    expect(asOrder("2")).toBeNull();
  });
});
