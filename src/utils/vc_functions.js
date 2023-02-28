const state = require("../state");

const vc_value = function (vc, ip) {
  return vc.hasOwnProperty(ip) ? vc[ip] : 0;
};

const kvs_entry = function (kvs, key) {
  return kvs.hasOwnProperty(key) ? kvs[key] : null;
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
// 'CONCURRENT' if vc1 || vc2
// 'NEWER' if vc1 > vc2
// 'OLDER' if vc1 < vc2
// 'SAME' if vc1 = vc2
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
    return "EQUAL";
  } else if (greater) {
    return "NEWER";
  } else if (less) {
    return "OLDER";
  } else {
    return "CONCURRENT";
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
    const v1 = kvs_entry(state.kvs, key);
    const v2 = kvs_entry(kvs2, key);

    if (v1 == null) {
      new_kvs[key] = v2;
      return;
    } else if (v2 == null) {
      new_kvs[key] = v1;
      return;
    }

    const vc1 = v1.last_written_vc;
    const vc2 = v2.last_written_vc;

    const t1 = v1.timestamp;
    const t2 = v2.timestamp;

    const combined_vc = max_vc(vc1, vc2);

    /*TODO: go over if both are concurrent, should we really not combine vector clocks?*/
    if (compare_vc(vc1, vc2) == "CONCURRENT") {
      if (t1 < t2) {
        /* vc2 is newer */
        new_kvs[key] = {
          last_written_vc: vc2,
          value: v2.value,
          timestamp: t2,
        };
      } else {
        /* vc1 is newer*/
        new_kvs[key] = {
          last_written_vc: vc1,
          value: v1.value,
          timestamp: t1,
        };
      }
    } else if (compare_vc(vc1, vc2) == "OLDER") {
      /* vc2 is newer*/
      new_kvs[key] = {
        last_written_vc: vc2,
        value: v2.value,
        timestamp: t2,
      };
    } else if (compare_vc(vc1, vc2) == "NEWER") {
      /* vc1 is newer*/
      new_kvs[key] = {
        last_written_vc: vc1,
        value: v1.value,
        timestamp: t1,
      };
    } else if (compare_vc(vc1, vc2) == "EQUAL") {
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
