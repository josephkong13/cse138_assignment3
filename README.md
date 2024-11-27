## Distributed Key-Value Store

This project is a distributed, sharded, fault-tolerant key-value store which provides high availability while guaranteeing clients see operations in causal order.

## How to run

- Create a docker subnet: `sudo docker network create --subnet=10.10.0.0/16 kv_subnet` 

- Build docker image: `sudo docker build -t kvs:2.0 ./ --network="host"`

- Create however many replicas you wish: <pre>sudo docker run \
  -d \
  --net kv_subnet \
  --ip 10.10.0.2 \
  --name "kvs-replica1" \
  --publish 8080:8080 \
  --env ADDRESS="10.10.0.2:8080" \
  kvs:2.0</pre>
    <pre>sudo docker run \
  -d \
  --net kv_subnet \
  --ip 10.10.0.3 \
  --name "kvs-replica2" \
  --publish 8081:8080 \
  --env ADDRESS="10.10.0.3:8080" \
  kvs:2.0</pre> ...

- Initialize the replicas with a view with the replicas you created: <pre>curl \
--request PUT \
--header "Content-Type: application/json" \
--write-out "%{http_code}\n" \
--data '{"view": ["address1:port1", "address2:port2", "address3:port3"]}' \
http://<node-address:port>/kvs/admin/view</pre>

## API

- Note: For the client to see operations in causal order, it is responsible for including the most recent causal metadata it has received from the server in all of its requests to the server

- `PUT /kvs/data/<Key>`: Write a key with a new value
    - Request body: <pre>curl \
--request PUT \
--header "Content-Type: application/json" \
--write-out "%{http_code}\n" \
--data '{"val": "sampleVal", "causal-metadata": {CLIENT_CAUSAL_METADATA_HERE}}' \
http://<node-address:port>/kvs/data/sampleKey</pre>
    - Response: <pre>{"causal-metadata": {RETURNED_CAUSAL_METADATA}}
201</pre>

- `GET /kvs/data/<Key>`: Get the value of the key, if it exists
    - Request body: <pre>curl \
--request GET \
--header "Content-Type: application/json" \
--write-out "%{http_code}\n" \
--data '{"causal-metadata": {CLIENT_CAUSAL_METADATA_HERE}}' \
http://<node-address:port>/kvs/data/sampleKey</pre>
    - Response (value didn't exist): <pre>{"causal-metadata": {RETURNED_CAUSAL_METADATA}}
404</pre>
    - Response (value exists): <pre>{"val": "sampleVal", "causal-metadata": {RETURNED_CAUSAL_METADATA}}
200</pre>

- `DELETE /kvs/data/<Key>`: Delete the value of a key or inform that it doesn't exist
    - Request body: <pre>curl \
--request DELETE \
--header "Content-Type: application/json" \
--write-out "%{http_code}\n" \
--data '{"causal-metadata": {CLIENT_CAUSAL_METADATA_HERE}}' \
http://<node-address:port>/kvs/data/sampleKey</pre>
    - Response (value didn't exist): <pre>{"causal-metadata": {RETURNED_CAUSAL_METADATA}}
404</pre>
    - Response (value exists): <pre>{"causal-metadata": {RETURNED_CAUSAL_METADATA}}
200</pre>