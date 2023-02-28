const state = {
  initialized: false, // initialized state
  view: [],
  // example of key value pair
  // key: { last_written_vc: vector_clock, value: value, timestamp: datetime }
  kvs: {},
  // operations_list entry
  // [ vector_clock_value, ... ]
  // ip: clock_value (number of write operations this IP has done)
  // operations_list: [],
  total_vc: {},
};

module.exports = state;
