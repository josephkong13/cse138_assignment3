
const { hash_search, hash_sort, random_hash } = require("./shard_functions");

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

    for(let i = 0; i < num_hashes - 1; i++)
      expect(test_hashes[i][0] < test_hashes[i + 1][0]);

  });

  test("Binary search hashes", () => {
    
    test_hashes.sort(hash_sort);

    const test_key = random_hash(7);
    const [ hash_result, hash_shard ] = hash_search(test_hashes, test_key);
    
    let j = 0;
    for(let i = 0; i < num_hashes; i++) {
      if(test_hashes[i][0] == hash_result) {
        j = i - 1;
        break;
      }
    }

    console.log(j);

    if(j < 0)
      expect(test_key < hash_result)

    console.log(test_hashes[j][0]);
    console.log(test_key);
    console.log(hash_result);

    expect(test_key < hash_result && test_hashes[j][0] < test_key);

  });

});
