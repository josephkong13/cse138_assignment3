const state = require("../state");
const { merge_kvs } = require("./vc_functions");

const s1 = {
  initialized: true,
  view: ["10.0.0.1", "10.0.0.2"],
  kvs: {
    x: {
      last_written_vc: { "10.0.0.1": 1 },
      value: 0,
      timestamp: Date.now(),
    },
  },
  total_vc: { "10.0.0.1": 1, "10.0.0.2": 0 },
};

const s2 = {
  initialized: true,
  view: ["10.0.0.1", "10.0.0.2"],
  kvs: {
    x: {
      last_written_vc: { "10.0.0.2": 1 },
      value: 1,
      timestamp: Date.now() + 100,
    },
  },
  total_vc: { "10.0.0.1": 0, "10.0.0.2": 1 },
};

const s3 = {
  initialized: true,
  view: ["10.0.0.1", "10.0.0.2"],
  kvs: {
    y: {
      last_written_vc: { "10.0.0.2": 1 },
      value: 1,
      timestamp: Date.now(),
    },
    x: {
      last_written_vc: { "10.0.0.1": 3 },
      value: 1,
      timestamp: Date.now(),
    },
  },
  total_vc: { "10.0.0.1": 3, "10.0.0.2": 3 },
};

const s4 = {
  initialized: true,
  view: ["10.0.0.1", "10.0.0.2", "10.0.0.3"],
  kvs: {
    x: {
      last_written_vc: { "10.0.0.1": 1, "10.0.0.2": 0, "10.0.0.3": 1 },
      value: 4,
      timestamp: Date.now(),
    },
    y: {
      last_written_vc: { "10.0.0.1": 1, "10.0.0.2": 0, "10.0.0.3": 0 },
      value: 1,
      timestamp: Date.now(),
    },
    z: {
      last_written_vc: { "10.0.0.1": 0, "10.0.0.2": 2, "10.0.0.3": 0 },
      value: 3,
      timestamp: Date.now(),
    },
    a: {
      last_written_vc: { "10.0.0.1": 1, "10.0.0.2": 0, "10.0.0.3": 0 },
      value: 1,
      timestamp: Date.now(),
    },
    b: {
      last_written_vc: { "10.0.0.1": 1, "10.0.0.2": 0, "10.0.0.3": 0 },
      value: 1,
      timestamp: Date.now(),
    },
    c: {
      last_written_vc: { "10.0.0.1": 1, "10.0.0.2": 0, "10.0.0.3": 0 },
      value: 1,
      timestamp: Date.now() + 100,
    },
  },
  total_vc: { "10.0.0.1": 5, "10.0.0.2": 2, "10.0.0.3": 1 },
};

const s5 = {
  initialized: true,
  view: ["10.0.0.1", "10.0.0.2", "10.0.0.3"],
  kvs: {
    x: {
      last_written_vc: { "10.0.0.1": 0, "10.0.0.2": 0, "10.0.0.3": 1 },
      value: 1,
      timestamp: Date.now(),
    },
    y: {
      last_written_vc: { "10.0.0.1": 1, "10.0.0.2": 0, "10.0.0.3": 1 },
      value: 2,
      timestamp: Date.now(),
    },
    z: {
      last_written_vc: { "10.0.0.1": 0, "10.0.0.2": 2, "10.0.0.3": 0 },
      value: 3,
      timestamp: Date.now(),
    },
    c: {
      last_written_vc: { "10.0.0.1": 0, "10.0.0.2": 0, "10.0.0.3": 1 },
      value: 4,
      timestamp: Date.now(),
    },
    d: {
      last_written_vc: { "10.0.0.1": 0, "10.0.0.2": 0, "10.0.0.3": 1 },
      value: 2,
      timestamp: Date.now(),
    },
  },
  total_vc: { "10.0.0.1": 1, "10.0.0.2": 2, "10.0.0.3": 4 },
};

const s6 = {
  initialized: true,
  view: ["10.0.0.1", "10.0.0.2", "10.0.0.3"],
  kvs: {
    x: {
      last_written_vc: { "10.0.0.1": 1, "10.0.0.2": 0, "10.0.0.3": 1 },
      value: 4,
      timestamp: Date.now(),
    },
    y: {
      last_written_vc: { "10.0.0.1": 1, "10.0.0.2": 0, "10.0.0.3": 1 },
      value: 2,
      timestamp: Date.now(),
    },
    z: {
      last_written_vc: { "10.0.0.1": 0, "10.0.0.2": 2, "10.0.0.3": 0 },
      value: 3,
      timestamp: Date.now(),
    },
    a: {
      last_written_vc: { "10.0.0.1": 1, "10.0.0.2": 0, "10.0.0.3": 0 },
      value: 1,
      timestamp: Date.now(),
    },
    b: {
      last_written_vc: { "10.0.0.1": 1, "10.0.0.2": 0, "10.0.0.3": 0 },
      value: 1,
      timestamp: Date.now(),
    },
    c: {
      last_written_vc: { "10.0.0.1": 1, "10.0.0.2": 0, "10.0.0.3": 0 },
      value: 1,
      timestamp: s4.kvs.c.timestamp,
    },
    d: {
      last_written_vc: { "10.0.0.1": 0, "10.0.0.2": 0, "10.0.0.3": 1 },
      value: 2,
      timestamp: Date.now(),
    },
  },
  total_vc: { "10.0.0.1": 5, "10.0.0.2": 2, "10.0.0.3": 4 },
};

/*
  IP = 10.0.0.1
  KVS = {
    x:4, [1 0 1]
    y:1, [1 0 0]
    z:3, [0 2 0]
    a:1, [1 0 0]
    b:1, [1 0 0]
    c:1, [1 0 0]
  }
  TOTALVC = [5, 2, 1]

  IP = 10.0.0.3
  KVS = {
    x:1, [0 0 1]
    y:2, [1 0 1]
    z:3, [0 2 0]
    c:4, [0 0 1]
    d:2, [0 0 1]
  }
  TOTALVC = [1, 2, 4]

  OUTPUT:
  x:4, [1 0 1]
  y:2, [1 0 1] 
  z:3, [0 2 0]
  a:1, [1 0 0]
  b:1, [1 0 0]
  c:1, [1 0 0]
  d:2, [0 0 1]
  TOTALVC = [5, 2, 4]
*/

describe("Simple merge test", () => {
  beforeEach(() => {
    state.initialized = s1.initialized;
    state.view = s1.view;
    state.kvs = s1.kvs;
    state.total_vc = s1.total_vc;
  });

  test("Merge nothing", () => {
    merge_kvs({}, {});
    expect(state).toEqual(s1);
  });

  test("Merge concurrent", () => {
    merge_kvs(s2.total_vc, s2.kvs);
    expect(state.kvs).toEqual(s2.kvs);
    expect(state.total_vc).toEqual({ "10.0.0.1": 1, "10.0.0.2": 1 });
  });

  test("Merge concurrent", () => {
    merge_kvs(s2.total_vc, s2.kvs);
    expect(state.kvs).toEqual(s2.kvs);
    expect(state.total_vc).toEqual({ "10.0.0.1": 1, "10.0.0.2": 1 });
  });

  test("Merge newer", () => {
    merge_kvs(s3.total_vc, s3.kvs);
    expect(state.kvs).toEqual(s3.kvs);
    expect(state.total_vc).toEqual(s3.total_vc);
  });

  test("Merge older", () => {
    state.kvs = s3.kvs;
    state.total_vc = s3.total_vc;
    merge_kvs(s1.total_vc, s1.kvs);
    expect(state.kvs).toEqual(s3.kvs);
    expect(state.total_vc).toEqual(s3.total_vc);
  });

  test("Merge variety", () => {
    state.kvs = s4.kvs;
    state.total_vc = s4.total_vc;
    state.view = s4.view;
    merge_kvs(s5.total_vc, s5.kvs);
    expect(state.kvs).toEqual(s6.kvs);
    expect(state.total_vc).toEqual(s6.total_vc);
  });
});
