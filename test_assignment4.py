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

def create_partition():
    subprocess.call(['bash', './make_partition.sh', '1', '2', '3', '4'])
    subprocess.call(['bash', './make_partition.sh', '2', '1', '3', '4'])
    subprocess.call(['bash', './make_partition.sh', '3', '1', '2', '4'])
    subprocess.call(['bash', './make_partition.sh', '4', '1', '2', '3'])

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
keys = ['key1', 'key2', 'key3']
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
        create_partition()

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

        create_partition()

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

        num_keys = 10000

        # send 10000 keys to shards 1 and 2, we'll expect some to be forwarded to shard 3
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
            print(body['count'])

        res = put(
            kvs_view_admin_url(ports[0], hosts[0]), 
            { "num_shards": 4, "nodes": new_view_addresses }
        );

        time.sleep(3)

        # see how many keys in each shard
        for i in range(4):
            res = get(kvs_data_url(ports[i], hosts[i]), causal_metadata_body({}))
            self.assertEqual(res.status_code, 200, 'Bad status code') # causing error
            body = res.json()
            self.assertIn('count', body,
                        msg='Key not found in json response')
            print(body['count'])

    def test_key_distribution_on_reshard_2(self):
        new_view_addresses = view_addresses;
        res = put(
            kvs_view_admin_url(ports[0], hosts[0]), 
            { "num_shards": 4, "nodes": new_view_addresses }
        );

        num_keys = 10000

        # send 10000 keys to shards 1 and 2, we'll expect some to be forwarded to shard 3
        for i in range(num_keys):
            res = put(
                kvs_data_key_url("key"+str(i), ports[i%3], hosts[i%3]),
                put_val_body("val"+str(i))
            )
            self.assertEqual(res.status_code, 201, 'Bad status code')

        time.sleep(3)

        # see how many keys in each shard
        for i in range(4):
            res = get(kvs_data_url(ports[i], hosts[i]), causal_metadata_body({}))
            self.assertEqual(res.status_code, 200, 'Bad status code') # causing error
            body = res.json()
            self.assertIn('count', body,
                        msg='Key not found in json response')
            print(body['count'])

        res = put(
            kvs_view_admin_url(ports[0], hosts[0]), 
            { "num_shards": 3, "nodes": new_view_addresses[:3] }
        );

        time.sleep(3)

        # see how many keys in each shard
        for i in range(3):
            res = get(kvs_data_url(ports[i], hosts[i]), causal_metadata_body({}))
            self.assertEqual(res.status_code, 200, 'Bad status code') # causing error
            body = res.json()
            self.assertIn('count', body,
                        msg='Key not found in json response')
            print(body['count'])

if __name__ == '__main__':
    unittest.main(argv=['first-arg-is-ignored'], exit=False)
