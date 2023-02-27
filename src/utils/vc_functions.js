const state = require("../state");

const vc_value = function (vc, ip) {
  return vc[ip] ? vc[ip] : 0;
};

const kvs_entry = function (kvs, key) {
  return kvs[key] ? kvs[key] : null;
};

const max_vc = function (vc1, vc2) {
  const max_vc = {};
  state.view.forEach((ip_address) => {
    max_vc[ip_address] = Math.max(
      vc_value(vc1, ip_address),
      vc_value(vc2, ip_address)
    );
  });

  return max_vc;
};

/*
Compares two vector clocks
// 0 if vc1 || vc2
// 1 if vc1 > vc2
// -1 if vc1 < vc2
// 2 if vc1 = vc2
*/
const compare_vc = function (vc1, vc2) {
  let equal = true;
  let greater = true;
  let less = true;

  state.view.forEach((ip_address) => {
    const v1 = vc_value(vc1, ip_address);
    const v2 = vc_value(vc2, ip_address);

    if (v1 !== v2) {
      equal = false;
    }
    if (v1 < v2) {
      greater = false;
    }
    if (v1 > v2) {
      less = false;
    }
  });

  if (equal) {
    return 2;
  } else if (greater) {
    return 1;
  } else if (less) {
    return -1;
  } else {
    return 0;
  }
};

/*
Will merge the kvs stores of the current replica and the second
Modifies state.kvs and state.total_vc
*/

const merge_kvs = function (total_vc2, kvs2) {
  const new_kvs = {};
  const keys = [...new Set([...Object.keys(state.kvs), ...Object.keys(kvs2)])];

  keys.forEach((key) => {
    const v1 = kvs_entry(key, state.kvs);
    const v2 = kvs_entry(key, kvs2);

    const vc1 = v1.last_written_vc;
    const vc2 = v2.last_written_vc;

    const t1 = v1.timestamp;
    const t2 = v2.timestamp;

    const d1 = new Date(t1);
    const d2 = new Date(t2);
    const combined_vc = max_vc(vc1, vc2);

    if (v1 == null) {
      new_kvs[key] = v2;
    } else if (v2 == null) {
      new_kvs[key] = v1;
    } else if (compare_vc(vc1, vc2) == 0) {
      if (d1 < d2) {
        /* vc2 is newer */
        new_kvs[key] = {
          last_written_vc: combined_vc,
          value: v2.value,
          timestamp: t2,
        };
      } else {
        /* vc1 is newer*/
        new_kvs[key] = {
          last_written_vc: combined_vc,
          value: v1.value,
          timestamp: t1,
        };
      }
    } else if (compare_vc(vc1, vc2) == -1) {
      /* vc2 is newer*/
      new_kvs[key] = {
        last_written_vc: combined_vc,
        value: v2.value,
        timestamp: t2,
      };
    } else if (compare_vc(vc1, vc2) == 1) {
      /* vc1 is newer*/
      new_kvs[key] = {
        last_written_vc: combined_vc,
        value: v1.value,
        timestamp: t1,
      };
    } else if (compare_vc(vc1, vc2) == 2) {
      /* vc1 == vc2 */
      new_kvs[key] = {
        last_written_vc: combined_vc,
        value: v1.value,
        timestamp: t1,
      };
    }
  });

  state.kvs = new_kvs;
  state.total_vc = max_vc(state.total_vc, total_vc2);
};

module.exports = { max_vc, merge_kvs, compare_vc };
