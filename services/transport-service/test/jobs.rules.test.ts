import { describe, expect, test } from "bun:test";
import { canDo, coordinateProblem, lockKeys, NEXT_STATUS, scheduleProblem, windowEnd, type JobAction, type JobStatus } from "../src/modules/jobs/jobs.rules";

const ALL: JobStatus[] = ["pending", "assigned", "in_progress", "completed", "cancelled", "problem"];

describe("job state machine", () => {
  test("completed and cancelled jobs accept no action", () => {
    for (const action of ["edit", "assign", "start", "complete", "problem", "cancel"] as JobAction[]) {
      expect(canDo("completed", action)).toBe(false);
      expect(canDo("cancelled", action)).toBe(false);
    }
  });
  test("start only from assigned or problem; complete and problem only from in_progress", () => {
    expect(ALL.filter((s) => canDo(s, "start"))).toEqual(["assigned", "problem"]);
    expect(ALL.filter((s) => canDo(s, "complete"))).toEqual(["in_progress"]);
    expect(ALL.filter((s) => canDo(s, "problem"))).toEqual(["in_progress"]);
  });
  test("a pending job cannot be started before it has a vehicle and driver", () => {
    expect(canDo("pending", "start")).toBe(false);
    expect(canDo("pending", "assign")).toBe(true);
  });
  test("an in-progress job cannot be re-assigned", () => {
    expect(canDo("in_progress", "assign")).toBe(false);
  });
  test("each action leads to the documented status", () => {
    expect(NEXT_STATUS).toEqual({ assign: "assigned", start: "in_progress", complete: "completed", problem: "problem", cancel: "cancelled" });
  });
});

describe("input rules", () => {
  test("schedule end before start is a problem; missing sides are fine", () => {
    expect(scheduleProblem(new Date("2026-11-18T10:00:00Z"), new Date("2026-11-18T09:00:00Z"))).not.toBeNull();
    expect(scheduleProblem(new Date("2026-11-18T10:00:00Z"), new Date("2026-11-18T10:00:00Z"))).toBeNull();
    expect(scheduleProblem(null, new Date())).toBeNull();
    expect(scheduleProblem(undefined, undefined)).toBeNull();
  });
  test("coordinates must come as a pair", () => {
    expect(coordinateProblem("pickup", 13.7, 100.5)).toBeNull();
    expect(coordinateProblem("pickup", null, null)).toBeNull();
    expect(coordinateProblem("pickup", 0, 0)).toBeNull(); // 0 is a real value, not "missing"
    expect(coordinateProblem("pickup", 13.7, null)).toContain("pickup_latitude");
  });
});

describe("lock keys", () => {
  test("sorted and without missing parts, so the order never depends on who asks", () => {
    expect(lockKeys(5n, 9n, 2n)).toEqual(["transport:driver:9", "transport:job:5", "transport:vehicle:2"]);
    expect(lockKeys(5n, null, undefined)).toEqual(["transport:job:5"]);
  });
});

describe("driver window end", () => {
  const updated = new Date("2026-11-18T12:00:00Z");
  test("running job has no end; stopped jobs end at the recorded end or the last update", () => {
    expect(windowEnd({ actual_end_at: null, job_status: "in_progress", updated_at: updated })).toBeNull();
    expect(windowEnd({ actual_end_at: null, job_status: "problem", updated_at: updated })).toBe(updated);
    const end = new Date("2026-11-18T11:00:00Z");
    expect(windowEnd({ actual_end_at: end, job_status: "completed", updated_at: updated })).toBe(end);
  });
});
