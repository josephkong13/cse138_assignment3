###################
# Course: CSE 138
# Quarter: Winter 2023
# Assignment: #3
# Author: Amin Karbas <mkarbasf@ucsc.edu>
###################

# Preferably, these should be run when nodes are partitioned, too.

import sys
import time
import unittest

import requests  # pip install requests
import subprocess

def create_partition(node_count, partition_list):

    # arg like: [[1, 2], [3, 4]]
    # creates two partitions with nodes 1 and 2, and one with nodes 3 and 4.

    for partition in partition_list:
        for node in partition:
            args = ['bash', './make_partition.sh', str(node)]
            for node_to_partition in range(1, node_count+1):

                # partition away the node if it's not in our partition
                if node_to_partition not in partition:
                    args.append(str(node_to_partition))

            subprocess.call(args)

def remove_partition():
    subprocess.call(['bash', './remove_partition.sh'])

# Setup:


def usage():
    print(
        f'Usage: {sys.argv[0]} local_port1:ip1:port1 local_port2:ip2:port2 [local_port3:ip3:port3...]')
    sys.exit(1)


def check_arg_count():
    if len(sys.argv) < 3:
        usage()


def parse_args():
    check_arg_count()
    local_ports = []
    view = []
    for arg in sys.argv[1:]:
        try:
            col1_idx = arg.find(':')
            local_ports.append(int(arg[:col1_idx]))
            view.append(arg[col1_idx+1:])
        except:
            usage()
    return local_ports, view


ports, view_addresses = parse_args()
hosts = ['localhost'] * len(ports)
keys = ['hello1', 'hello2', 'hello3']
vals = ['Value 1', 'val2', 'third_value']
causal_metadata_key = 'causal-metadata'


# Requests:


def get(url, body={}):
    return requests.get(url, json=body)


def put(url, body={}):
    return requests.put(url, json=body)


def delete(url, body={}):
    return requests.delete(url, json=body)


# URLs:


def make_base_url(port, host='localhost', protocol='http'):
    return f'{protocol}://{host}:{port}'


def kvs_view_admin_url(port, host='localhost'):
    return f'{make_base_url(port, host)}/kvs/admin/view'


def kvs_data_key_url(key, port, host='localhost'):
    return f'{make_base_url(port, host)}/kvs/data/{key}'


def kvs_data_url(port, host='localhost'):
    return f'{make_base_url(port, host)}/kvs/data'


# Bodies:

def nodes_list(ports, hosts=None):
    if hosts is None:
        hosts = ['localhost'] * len(ports)
    return [f'{h}:{p}' for h, p in zip(hosts, ports)]


def put_view_body(addresses):
    return {'view': addresses}

def put_partition_body(partition):
    return { 'partition': partition }

def causal_metadata_body(cm={}):
    return {causal_metadata_key: cm}


def causal_metadata_from_body(body):
    return body[causal_metadata_key]


def put_val_body(val, cm=None):
    body = causal_metadata_body(cm)
    body['val'] = val
    # print(body)
    return body


class TestAssignment1(unittest.TestCase):
    def setUp(self):
        remove_partition()
        # with view_timestamp below line should be unnecessary
        # time.sleep(10) # this is necessary... with partitioning i think some messages get stuck in transit, and the messages from one test get sent during the next test. lmao.
        # Uninitialize all nodes:
        for h, p in zip(hosts, ports):
            # delete(partition_url(p, h))
            delete(kvs_view_admin_url(p, h))

    def test_resharting(self):
        # initialize the view
        new_view_addresses = view_addresses;
        res = put(
            kvs_view_admin_url(ports[0], hosts[0]), 
            { "num_shards": 1, "nodes": [ new_view_addresses[0] ] }
        );
        self.assertEqual(res.status_code, 200, msg='Bad status code')

        res = put(
            kvs_view_admin_url(ports[1], hosts[1]), 
            { "num_shards": 1, "nodes": [ new_view_addresses[1] ] }
        );

        res = put(
            kvs_data_key_url("hello1", ports[0], hosts[0]),
            put_val_body("420")
        )
        self.assertEqual(res.status_code, 201, 'Bad status code')

        res0 = get(kvs_data_key_url("hello1", ports[0], hosts[0]), causal_metadata_body())
        body0 = res0.json();
        self.assertIn('val', body0, 'No value')
        val0 = body0['val']
        self.assertEqual(val0, "420");

        res = put(
            kvs_view_admin_url(ports[0], hosts[0]), 
            { "num_shards": 2, "nodes": new_view_addresses[:2] }
        );

        # Wait for replicas to sync up before changing view
        time.sleep(5)

        # Make sure
        res0 = get(kvs_data_key_url("hello1", ports[0], hosts[0]), causal_metadata_body())
        self.assertEqual(res0.status_code, 200);
        body0 = res0.json();
        self.assertIn('val', body0, 'No value')
        val0 = body0['val']
        self.assertEqual(val0, "420");

        res0 = get(kvs_data_key_url("hello1", ports[1], hosts[1]), causal_metadata_body())
        body0 = res0.json();
        self.assertIn('val', body0, 'No value')
        val0 = body0['val']
        self.assertEqual(val0, "420");

    def test_resharting_2(self):
        # initialize the view
        new_view_addresses = view_addresses;
        res = put(
            kvs_view_admin_url(ports[0], hosts[0]), 
            { "num_shards": 1, "nodes": [ new_view_addresses[0] ] }
        );
        self.assertEqual(res.status_code, 200, msg='Bad status code')

        res = put(
            kvs_view_admin_url(ports[1], hosts[1]), 
            { "num_shards": 1, "nodes": [ new_view_addresses[1] ] }
        );

        # this should go to shard 2 after reshard
        res = put(
            kvs_data_key_url("hello1", ports[0], hosts[0]),
            put_val_body("420")
        )
        self.assertEqual(res.status_code, 201, 'Bad status code')

        # this should go to shard 1 after reshard
        res = put(
            kvs_data_key_url("hello2", ports[1], hosts[1]),
            put_val_body("69")
        )
        self.assertEqual(res.status_code, 201, 'Bad status code')

        # re-shard
        res = put(
            kvs_view_admin_url(ports[0], hosts[0]), 
            { "num_shards": 2, "nodes": new_view_addresses[:2] }
        );

        # Wait for replicas to sync up before changing view
        time.sleep(5)

        # Make partition to disable request forwarding
        create_partition(2, [[1], [2]])

        time.sleep(2)

        # Check that keys got moved correctly
        res0 = get(kvs_data_key_url("hello1", ports[1], hosts[1]), causal_metadata_body())
        body0 = res0.json();
        self.assertIn('val', body0, 'No value')
        val0 = body0['val']
        self.assertEqual(val0, "420");

        res0 = get(kvs_data_key_url("hello2", ports[0], hosts[0]), causal_metadata_body())
        body0 = res0.json();
        self.assertIn('val', body0, 'No value')
        val0 = body0['val']
        self.assertEqual(val0, "69");

        # Test that shard forwarding was disabled
        res0 = get(kvs_data_key_url("hello1", ports[0], hosts[0]), causal_metadata_body())
        self.assertEqual(res0.status_code, 503, 'Bad status code')

        remove_partition()

        time.sleep(5)

        # Test that shard forwarding works again
        res0 = get(kvs_data_key_url("hello1", ports[0], hosts[0]), causal_metadata_body())
        body0 = res0.json();
        self.assertIn('val', body0, 'No value')
        val0 = body0['val']
        self.assertEqual(val0, "420");

    def test_shard_forwarding(self):
        # initialize the view
        new_view_addresses = view_addresses;
        res = put(
            kvs_view_admin_url(ports[0], hosts[0]), 
            { "num_shards": 1, "nodes": [ new_view_addresses[0] ] }
        );
        self.assertEqual(res.status_code, 200, msg='Bad status code')

        res = put(
            kvs_view_admin_url(ports[1], hosts[1]), 
            { "num_shards": 1, "nodes": [ new_view_addresses[1] ] }
        );

        res = put(
            kvs_data_key_url("hello1", ports[0], hosts[0]),
            put_val_body("420")
        )
        self.assertEqual(res.status_code, 201, 'Bad status code')

        res0 = get(kvs_data_key_url("hello1", ports[0], hosts[0]), causal_metadata_body())
        body0 = res0.json();
        self.assertIn('val', body0, 'No value')
        val0 = body0['val']
        self.assertEqual(val0, "420");

        res = put(
            kvs_view_admin_url(ports[0], hosts[0]), 
            { "num_shards": 2, "nodes": new_view_addresses[:2] }
        );

        # Wait for replicas to sync up before changing view
        time.sleep(5)

        create_partition(2, [[1], [2]])

        time.sleep(2)

        res0 = get(kvs_data_key_url("hello1", ports[0], hosts[0]), causal_metadata_body())
        self.assertEqual(res0.status_code, 503);
        # print(res0.json())

        remove_partition()

        time.sleep(5)

        res0 = get(kvs_data_key_url("hello1", ports[0], hosts[0]), causal_metadata_body())
        body0 = res0.json();
        self.assertIn('val', body0, 'No value')
        val0 = body0['val']
        self.assertEqual(val0, "420");


    def test_key_distribution_on_reshard_1(self):
        new_view_addresses = view_addresses;
        res = put(
            kvs_view_admin_url(ports[0], hosts[0]), 
            { "num_shards": 3, "nodes": new_view_addresses[:3] }
        );

        num_keys = 1000

        # send 1000 keys to shards 1 and 2, we'll expect some to be forwarded to shard 3
        for i in range(num_keys):
            res = put(
                kvs_data_key_url("key"+str(i), ports[i%2], hosts[i%2]),
                put_val_body("val"+str(i))
            )
            self.assertEqual(res.status_code, 201, 'Bad status code')

        time.sleep(3)

        # see how many keys in each shard
        for i in range(3):
            res = get(kvs_data_url(ports[i], hosts[i]), causal_metadata_body({}))
            self.assertEqual(res.status_code, 200, 'Bad status code') # causing error
            body = res.json()
            self.assertIn('count', body,
                        msg='Key not found in json response')
            # print(body['count'])
            average_keys = num_keys / 3
            self.assertLessEqual(body['count'], average_keys * 1.1);
            self.assertGreaterEqual(body['count'], average_keys * 0.9);

        res = put(
            kvs_view_admin_url(ports[0], hosts[0]), 
            { "num_shards": 4, "nodes": new_view_addresses[:4] }
        );

        time.sleep(3)

        # see how many keys in each shard
        for i in range(4):
            res = get(kvs_data_url(ports[i], hosts[i]), causal_metadata_body({}))
            self.assertEqual(res.status_code, 200, 'Bad status code') # causing error
            body = res.json()
            self.assertIn('count', body,
                        msg='Key not found in json response')
            # print(body['count'])
            average_keys = num_keys / 4
            self.assertLessEqual(body['count'], average_keys * 1.1);
            self.assertGreaterEqual(body['count'], average_keys * 0.9);

    # get data, reshard, get same data with causal metadata
    def test_key_distribution_on_reshard_2(self):
        new_view_addresses = view_addresses;
        res = put(
            kvs_view_admin_url(ports[0], hosts[0]), 
            { "num_shards": 4, "nodes": new_view_addresses[:4] }
        );

        num_keys = 1000

        # send 1000 keys to shards 1 and 2, we'll expect some to be forwarded to shard 3
        for i in range(num_keys):
            res = put(
                kvs_data_key_url("key"+str(i), ports[i%3], hosts[i%3]),
                put_val_body("val"+str(i))
            )
            self.assertEqual(res.status_code, 201, 'Bad status code')

        time.sleep(3)

        # Test the causal metadata isn't zero
        res = get(kvs_data_key_url("key99", ports[0], hosts[0]), causal_metadata_body())
        self.assertEqual(res.status_code, 200, 'Bad status code');
        body = res.json();
        cm = body['causal-metadata'];
        self.assertEqual(cm['vc']['10.10.0.4:8080'], 23, 'Bad causal metadata value');
        

        # see how many keys in each shard
        for i in range(4):
            res = get(kvs_data_url(ports[i], hosts[i]), causal_metadata_body({}))
            self.assertEqual(res.status_code, 200, 'Bad status code') # causing error
            body = res.json()
            self.assertIn('count', body,
                        msg='Key not found in json response')
            average_keys = num_keys / 4
            self.assertLessEqual(body['count'], average_keys * 1.1);
            self.assertGreaterEqual(body['count'], average_keys * 0.9);

        res = put(
            kvs_view_admin_url(ports[0], hosts[0]), 
            { "num_shards": 3, "nodes": new_view_addresses[:3] }
        );

        time.sleep(3);

        # Now the causal metadata for the same key should be zero, 
        # and we should be able to use the causal metadata from the last time we got the key
        res = get(kvs_data_key_url("key99", ports[0], hosts[0]), causal_metadata_body(cm))
        self.assertEqual(res.status_code, 200, 'Bad status code');
        body = res.json();
        cm = body['causal-metadata'];
        self.assertEqual(cm['vc']['10.10.0.2:8080'], 0, 'Bad causal metadata value');
        self.assertEqual(cm['vc']['10.10.0.3:8080'], 0, 'Bad causal metadata value');
        self.assertEqual(cm['vc']['10.10.0.4:8080'], 0, 'Bad causal metadata value');


        # see how many keys in each shard
        for i in range(3):
            res = get(kvs_data_url(ports[i], hosts[i]), causal_metadata_body({}))
            self.assertEqual(res.status_code, 200, 'Bad status code') # causing error
            body = res.json()
            self.assertIn('count', body,
                        msg='Key not found in json response')
            average_keys = num_keys / 3
            self.assertLessEqual(body['count'], average_keys * 1.1);
            self.assertGreaterEqual(body['count'], average_keys * 0.9);

    def test_uninitialized_get_view(self):
        for h, p in zip(hosts, ports):
            with self.subTest(host=h, port=p):
                res = get(kvs_view_admin_url(p, h))
                self.assertEqual(res.status_code, 200, msg='Bad status code')
                body = res.json()
                self.assertIn('view', body,
                              msg='Key not found in json response')
                self.assertEqual(body['view'], [], msg='Bad view')

    def test_put_get_view(self):
        for h, p in zip(hosts, ports):
            with self.subTest(host=h, port=p, verb='put'):
                res = put(
                    kvs_view_admin_url(p, h), 
                    { "num_shards": len(view_addresses), "nodes": view_addresses }
                );
                self.assertEqual(res.status_code, 200, msg='Bad status code')

        view = []
        i = 1

        for address in view_addresses:
            view.append({"shard_id": str(i), "nodes": [ str(address)] })
            i += 1

        for h, p in zip(hosts, ports):
            with self.subTest(host=h, port=p, verb='get'):
                res = get(kvs_view_admin_url(p, h))
                self.assertEqual(res.status_code, 200, msg='Bad status code')
                body = res.json()
                self.assertIn('view', body,
                              msg='Key not found in json response')
                self.assertEqual(body['view'], view,
                                 msg='Bad view')

    def test_spec_ex2(self):
        res = put(kvs_view_admin_url(ports[0], hosts[0]),
                  { "num_shards": 2, "nodes": view_addresses })
        self.assertEqual(res.status_code, 200, msg='Bad status code')

        time.sleep(1)

        res = put(kvs_data_key_url(keys[0], ports[1], hosts[1]),
                  put_val_body(vals[0]))
        self.assertEqual(res.status_code, 201, msg='Bad status code')
        body = res.json()
        self.assertIn(causal_metadata_key, body,
                      msg='Key not found in json response')
        cm1 = causal_metadata_from_body(body)

        res = put(kvs_data_key_url(keys[0], ports[0], hosts[0]),
                  put_val_body(vals[1], cm1))
        self.assertIn(res.status_code, {200, 201}, msg='Bad status code')
        body = res.json()
        self.assertIn(causal_metadata_key, body,
                      msg='Key not found in json response')
        cm1 = causal_metadata_from_body(body)

        res = put(kvs_data_key_url(keys[1], ports[1], hosts[1]),
                  put_val_body(vals[0], cm1))
        self.assertEqual(res.status_code, 201, msg='Bad status code')
        body = res.json()
        self.assertIn(causal_metadata_key, body,
                      msg='Key not found in json response')
        cm1 = causal_metadata_from_body(body)

        res = get(kvs_data_key_url(keys[1], ports[1], hosts[1]),
                  causal_metadata_body())
        self.assertEqual(res.status_code, 200, msg='Bad status code')
        body = res.json()
        self.assertIn(causal_metadata_key, body,
                      msg='Key not found in json response')
        cm2 = causal_metadata_from_body(body)
        self.assertIn('val', body, msg='Key not found in json response')
        self.assertEqual(body['val'], vals[0], 'Bad value')

        res = get(kvs_data_key_url(keys[0], ports[1], hosts[1]),
                  causal_metadata_body(cm2))
        self.assertIn(res.status_code, {200}, msg='Bad status code')
        body = res.json()
        self.assertIn(causal_metadata_key, body,
                      msg='Key not found in json response')
        cm2 = causal_metadata_from_body(body)

        if res.status_code == 200:
            self.assertIn('val', body, msg='Key not found in json response')
            self.assertEqual(body['val'], vals[1], 'Bad value')
            return

    def test_tie_breaking(self):
        res = put(kvs_view_admin_url(ports[0], hosts[0]),
                  { "num_shards": 2, "nodes": view_addresses })
        self.assertEqual(res.status_code, 200, msg='Bad status code')

        res = put(kvs_data_key_url(keys[0], ports[0], hosts[0]),
                  put_val_body(vals[0]))
        self.assertEqual(res.status_code, 201, msg='Bad status code')

        res = put(kvs_data_key_url(keys[0], ports[1], hosts[1]),
                  put_val_body(vals[1]))
        self.assertIn(res.status_code, {200, 201}, msg='Bad status code')

        time.sleep(10)

        res0 = get(kvs_data_key_url(keys[0], ports[0], hosts[0]),
                   causal_metadata_body())
        self.assertEqual(res0.status_code, 200, msg='Bad status code')
        body = res0.json()
        self.assertIn('val', body, msg='Key not found in json response')
        val0 = body['val']
        self.assertIn(val0, {vals[0], vals[1]}, 'Bad value')

        res1 = get(kvs_data_key_url(keys[0], ports[1], hosts[1]),
                   causal_metadata_body())
        self.assertEqual(res0.status_code, 200, msg='Bad status code')
        body = res1.json()
        self.assertIn('val', body, msg='Key not found in json response')
        val1 = body['val']
        self.assertIn(val1, {vals[0], vals[1]}, 'Bad value')

        self.assertEqual(val0, val1, 'Bad tie-breaking')

    def test_eventual_consistency_partition_1(self):
        # initialize the view
        new_view_addresses = view_addresses;
        res = put(kvs_view_admin_url(ports[0], hosts[0]),
                  { "num_shards": 2, "nodes": view_addresses[:4] })
        self.assertEqual(res.status_code, 200, msg='Bad status code')
        

        # ----------------- Start Create Partitions --------------------

        create_partition(4, [[1,3], [2,4]])
        time.sleep(1)

        # ----------------- End Create Partitions --------------------

        # ----------------- Start Put Data --------------------

        # put val in shard 1
        res = put(kvs_data_key_url(keys[1], ports[0], hosts[0]),
                  put_val_body(vals[1]))
        cm1 = causal_metadata_from_body(res.json());

        # put val in shard 2
        res = put(kvs_data_key_url(keys[0], ports[1], hosts[1]),
                  put_val_body(vals[0]))

        cm2 = causal_metadata_from_body(res.json());
        # ----------------- End Put Data --------------------


        # ----------------- Start Delete Partition --------------------
        remove_partition()

        # ----------------- End Delete Partition --------------------

        time.sleep(5)

        # ----------------- Test Consistency --------------------

        res0 = get(kvs_data_key_url(keys[0], ports[0], hosts[0]), causal_metadata_body())
        body0 = res0.json();
        self.assertIn('val', body0, 'No value')
        val0 = body0['val']
        self.assertEqual(val0, vals[0], 'Bad value')

        res1 = get(kvs_data_key_url(keys[1], ports[0], hosts[0]), causal_metadata_body())
        body1 = res1.json();
        self.assertIn('val', body1, 'No value')
        val1 = body1['val']
        self.assertEqual(val1, vals[1], 'Bad value')


        res0 = get(kvs_data_key_url(keys[0], ports[1], hosts[1]), causal_metadata_body())
        body0 = res0.json();
        self.assertIn('val', body0, 'No value')
        val0 = body0['val']
        self.assertEqual(val0, vals[0], 'Bad value')

        res1 = get(kvs_data_key_url(keys[1], ports[1], hosts[1]), causal_metadata_body())
        body1 = res1.json();
        self.assertIn('val', body1, 'No value')
        val1 = body1['val']
        self.assertEqual(val1, vals[1], 'Bad value')


        res0 = get(kvs_data_key_url(keys[0], ports[2], hosts[2]), causal_metadata_body())
        body0 = res0.json();
        self.assertIn('val', body0, 'No value')
        val0 = body0['val']
        self.assertEqual(val0, vals[0], 'Bad value')

        res1 = get(kvs_data_key_url(keys[1], ports[2], hosts[2]), causal_metadata_body())
        body1 = res1.json();
        self.assertIn('val', body1, 'No value')
        val1 = body1['val']
        self.assertEqual(val1, vals[1], 'Bad value')

    def test_eventual_consistency_partition_2(self):
        # initialize the view
        new_view_addresses = view_addresses;
        res = put(kvs_view_admin_url(ports[0], hosts[0]),
                  { "num_shards": 2, "nodes": view_addresses[:4] })
        self.assertEqual(res.status_code, 200, msg='Bad status code')
        

        # ----------------- Start Create Partitions --------------------

        create_partition(4, [[1,3], [2,4]])
        time.sleep(1)

        # ----------------- End Create Partitions --------------------

        # ----------------- Start Put Data --------------------

        # put val in replica 1
        res = put(kvs_data_key_url(keys[1], ports[0], hosts[0]),
                  put_val_body(vals[0]))
        # print(res.json())
        cm1 = causal_metadata_from_body(res.json());

        # put val in replica 2
        res = put(kvs_data_key_url(keys[1], ports[0], hosts[0]),
                  put_val_body(vals[1]))
        cm2 = causal_metadata_from_body(res.json());

        # ----------------- End Put Data --------------------


        # ----------------- Start Delete Partition --------------------

        remove_partition()

        # ----------------- End Delete Partition --------------------

        time.sleep(5)

        # ----------------- Test Consistency --------------------

        res0 = get(kvs_data_key_url(keys[1], ports[0], hosts[0]), causal_metadata_body())
        body0 = res0.json();
        self.assertIn('val', body0, 'No value')
        val0 = body0['val']

        res0 = get(kvs_data_key_url(keys[1], ports[1], hosts[1]), causal_metadata_body())
        body0 = res0.json();
        self.assertIn('val', body0, 'No value')
        val1 = body0['val']
        self.assertEqual(val0, val1, 'Bad value')

        res1 = get(kvs_data_key_url(keys[1], ports[2], hosts[2]), causal_metadata_body())
        body1 = res1.json();
        self.assertIn('val', body1, 'No value')
        val2 = body1['val']
        self.assertEqual(val1, val2, 'Bad value')

    def test_causal_consistency(self):
        # initialize the view
        new_view_addresses = view_addresses;
        res = put(kvs_view_admin_url(ports[0], hosts[0]),
                  { "num_shards": 2, "nodes": view_addresses[:4] })
        self.assertEqual(res.status_code, 200, msg='Bad status code')
        

        # ----------------- Start Create Partitions --------------------

        create_partition(4, [[1], [2], [3], [4]])

        time.sleep(1)

        # ----------------- End Create Partitions --------------------

        # ----------------- Start Put Data --------------------

        # put val in shard 1, replica 1
        res = put(kvs_data_key_url(keys[1], ports[0], hosts[0]),
                  put_val_body("1"))
        cm1 = causal_metadata_from_body(res.json());

        # put val in shard 1, replica 2
        res = put(kvs_data_key_url(keys[1], ports[2], hosts[2]),
                  put_val_body("2", cm1))

        cm2 = causal_metadata_from_body(res.json());

        # try to get key1 from shard 1, replica 1. should get 500.
        res = get(kvs_data_key_url(keys[1], ports[0], hosts[0]),
                  causal_metadata_body(cm2))

        self.assertEqual(res.status_code, 500, 'Bad status code')

        # ----------------- End Put Data --------------------


        # ----------------- Start Delete Partition --------------------

        remove_partition()

        # ----------------- End Delete Partition --------------------

        time.sleep(5)

        # ----------------- Test Consistency --------------------

        res0 = get(kvs_data_key_url(keys[1], ports[0], hosts[0]), causal_metadata_body())
        body0 = res0.json();
        self.assertIn('val', body0, 'No value')
        val0 = body0['val']
        self.assertEqual(val0, "2");

        res0 = get(kvs_data_key_url(keys[1], ports[1], hosts[1]), causal_metadata_body())
        body0 = res0.json();
        self.assertIn('val', body0, 'No value')
        val0 = body0['val']
        self.assertEqual(val0, "2");

        res0 = get(kvs_data_key_url(keys[1], ports[2], hosts[2]), causal_metadata_body())
        body0 = res0.json();
        self.assertIn('val', body0, 'No value')
        val0 = body0['val']
        self.assertEqual(val0, "2");
        
    # causally consistent write, then read
    def test_fuck_you_alice(self):
        # initialize the view
        new_view_addresses = view_addresses;
        res = put(kvs_view_admin_url(ports[0], hosts[0]),
                  { "num_shards": 2, "nodes": view_addresses[:4] })
        self.assertEqual(res.status_code, 200, msg='Bad status code')
        

        # ----------------- Start Create Partitions --------------------

        create_partition(4, [[2], [1,3,4]])

        time.sleep(1)

        # ----------------- End Create Partitions --------------------

        # ----------------- Start Put Data --------------------

        # put val in shard2, replica 1
        res = put(kvs_data_key_url(keys[0], ports[1], hosts[1]),
                  put_val_body("1"))
        cm1 = causal_metadata_from_body(res.json());

        res0 = get(kvs_data_key_url(keys[0], ports[1], hosts[1]), causal_metadata_body())
        body0 = res0.json();
        self.assertIn('val', body0, 'No value')
        val0 = body0['val']
        self.assertEqual(val0, "1");

        cm2 = causal_metadata_from_body(body0);

        # put val in shard1, replica 1(forwarded to shard2, replica2)
        res = put(
                kvs_data_key_url(keys[2], ports[0], hosts[0]),
                put_val_body("2", cm2)
        )

        res0 = get(kvs_data_key_url(keys[2], ports[0], hosts[0]), causal_metadata_body())
        body0 = res0.json();
        self.assertIn('val', body0, 'No value')
        val0 = body0['val']
        self.assertEqual(val0, "2");

        cm2 = causal_metadata_from_body(body0);

        # try to get val from shard2, replica1, should stall.
        res0 = get(kvs_data_key_url(keys[0], ports[1], hosts[1]), causal_metadata_body(cm2))
        self.assertEqual(res0.status_code, 500, "Should've stalled");

        # ----------------- End Put Data --------------------


        # ----------------- Start Delete Partition --------------------

        remove_partition()

        # ----------------- End Delete Partition --------------------

        time.sleep(5);

        # After removing partition, we should be able to retrieve the key.
        res0 = get(kvs_data_key_url(keys[0], ports[1], hosts[1]), causal_metadata_body(cm2))
        body0 = res0.json();
        self.assertIn('val', body0, "No value");
        val1 = body0['val'];
        self.assertEqual(val1, "1", "error not in kvs");

    # # causally consistent write, then read
    # def test_upstream_shit(self):
    #     # initialize the view
    #     new_view_addresses = view_addresses;
    #     res = put(kvs_view_admin_url(ports[0], hosts[0]),
    #               { "num_shards": 2, "nodes": view_addresses[:4] })
    #     self.assertEqual(res.status_code, 200, msg='Bad status code')
        

    #     # ----------------- Start Create Partitions --------------------

    #     create_partition(4, [[1], [2,3,4]])

    #     time.sleep(1)

    #     # ----------------- End Create Partitions --------------------

    #     # ----------------- Start Put Data --------------------

    #     # put val in shard2, replica 1
    #     res = put(kvs_data_key_url(keys[0], ports[0], hosts[0]),
    #               put_val_body("1"))
    #     print(res.json())
    #     cm1 = causal_metadata_from_body(res.json());

    #     res0 = get(kvs_data_key_url(keys[0], ports[0], hosts[0]), causal_metadata_body())
    #     body0 = res0.json();
    #     self.assertIn('val', body0, 'No value')
    #     val0 = body0['val']
    #     self.assertEqual(val0, "1");

    #     cm2 = causal_metadata_from_body(body0);

    #     # put val in shard1, replica 1(forwarded to shard2, replica2)
    #     res = put(
    #             kvs_data_key_url(keys[2], ports[1], hosts[1]),
    #             put_val_body("2", cm2)
    #     )

    #     res0 = get(kvs_data_key_url(keys[2], ports[1], hosts[1]), causal_metadata_body())
    #     body0 = res0.json();
    #     self.assertIn('val', body0, 'No value')
    #     val0 = body0['val']
    #     self.assertEqual(val0, "2");

    #     cm2 = causal_metadata_from_body(body0);

    #     # try to get val from shard1, replica1, should stall.
    #     res0 = get(kvs_data_key_url(keys[0], ports[0], hosts[0]), causal_metadata_body(cm2))
    #     self.assertEqual(res0.status_code, 500, "Should've stalled");

    #     # ----------------- End Put Data --------------------


    #     # ----------------- Start Delete Partition --------------------

    #     remove_partition()

    #     # ----------------- End Delete Partition --------------------

    #     time.sleep(5);

    #     # After removing partition, we should be able to retrieve the key.
    #     res0 = get(kvs_data_key_url(keys[0], ports[0], hosts[0]), causal_metadata_body(cm2))
    #     body0 = res0.json();
    #     self.assertIn('val', body0, "No value");
    #     val1 = body0['val'];
    #     self.assertEqual(val1, "1", "error not in kvs");


if __name__ == '__main__':
    unittest.main(argv=['first-arg-is-ignored'], exit=False)
