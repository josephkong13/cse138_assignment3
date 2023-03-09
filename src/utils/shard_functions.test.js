
const { hash_search, hash_sort, random_hash } = require("./shard_functions");

// non-deterministic testing, we randomly generate the hashes and test on that
describe("Hashing functions test", () => {

  let test_hashes = [];
  const num_hashes = 100;

  beforeEach(() => {

    // populate hashes
    for(let i = 0; i < num_hashes; i++)
      test_hashes.push([ random_hash(7), Math.floor((Math.random() * 3)) + 1 ]);

  });

  afterEach(() => {
    test_hashes = [];
  });

  test("Sort hashes", () => {
    
    test_hashes.sort(hash_sort);

    // every hash should be less than the one following it
    // not sure the expect works in sequence, TODO: check if it does
    for(let i = 0; i < num_hashes - 1; i++)
      expect(test_hashes[i][0] < test_hashes[i + 1][0]);

  });

  test("Binary search hashes", () => {
    
    test_hashes.sort(hash_sort);

    const test_key = random_hash(7);
    const [ hash_result, hash_shard ] = hash_search(test_hashes, test_key);

    let j = -1;
    for(let i = 0; i < num_hashes; i++) {
      if(test_hashes[i] == hash_result)
        j = i - 1;
    }

    let before_hash = "";

    if(j >= 0) {
      const [ before_hash_1, before_shard ] = test_hashes[j];
      before_hash = before_hash_1;
    } 
    
    const condition1 = before_hash < test_key && test_key < hash_result;
    const condition2 = test_key > test_hashes[test_hashes.length - 1][0] && 
                       hash_result == test_hashes[0][0];
    expect(condition1 || condition2).toBe(true); 
  });

  test("Binary search hashes (Small number of hashes in our array)", () => {
    
    test_hashes.sort(hash_sort);
    const reduced_size_test_hashes = test_hashes.slice(0,2);

    const test_key = random_hash(7);
    const [ hash_result, hash_shard ] = hash_search(reduced_size_test_hashes, test_key);

    let j = -1;
    for(let i = 0; i < reduced_size_test_hashes.length; i++) {
      if(reduced_size_test_hashes[i] == hash_result) {
        j = i - 1;
        break;
      }
    }

    let before_hash = "";

    if(j >= 0) {
      const [ before_hash1, before_shard ] = reduced_size_test_hashes[j];
      before_hash = before_hash1;
    }

    const condition1 = before_hash < test_key && test_key < hash_result;
    const condition2 = test_key > reduced_size_test_hashes[reduced_size_test_hashes.length - 1][0] && 
                       hash_result == reduced_size_test_hashes[0][0];
    expect(condition1 || condition2).toBe(true); 

  });
});
