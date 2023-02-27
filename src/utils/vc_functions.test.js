const state = require("../state");
const { merge_kvs, compare_vc } = require("./vc_functions");

const s1 = {
  initialized: true,
  view: ["10.0.0.1"],
  kvs: {
    x: {
      last_written_vc: { "10.0.0.1": 1 },
      value: 0,
      timestamp: Date.now(),
    },
  },
  total_vc: { "10.0.0.1": 1 },
};

describe("test", () => {
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
});
