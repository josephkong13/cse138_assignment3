
sudo docker network create --subnet=10.10.0.0/16 kv_subnet

sudo docker build -t kvs:2.0 ../ --network="host"

sudo docker run \
  -d \
  --net kv_subnet \
  --ip 10.10.0.2 \
  --name "kvs-replica1" \
  --publish 8080:8080 \
  --env ADDRESS="10.10.0.2:8080" \
  --cap-add=NET_ADMIN \
  kvs:2.0

sudo docker run \
  -d \
  --net kv_subnet \
  --ip 10.10.0.3 \
  --name "kvs-replica2" \
  --publish 8081:8080 \
  --env ADDRESS="10.10.0.3:8080" \
  --cap-add=NET_ADMIN \
  kvs:2.0

sudo docker run \
  -d \
  --net kv_subnet \
  --ip 10.10.0.4 \
  --name "kvs-replica3" \
  --publish 8082:8080 \
  --env ADDRESS="10.10.0.4:8080" \
  --cap-add=NET_ADMIN \
  kvs:2.0

sudo docker run \
  -d \
  --net kv_subnet \
  --ip 10.10.0.5 \
  --name "kvs-replica4" \
  --publish 8083:8080 \
  --env ADDRESS="10.10.0.5:8080" \
  --cap-add=NET_ADMIN \
  kvs:2.0

# python3 test_assignment3.py 8080:10.10.0.2:8080 8081:10.10.0.3:8080 8082:10.10.0.4:8080 8083:10.10.0.5:8080

echo Press any key to terminate

read n

sudo docker kill kvs-replica1
sudo docker rm kvs-replica1
sudo docker kill kvs-replica2
sudo docker rm kvs-replica2
sudo docker kill kvs-replica3
sudo docker rm kvs-replica3
sudo docker kill kvs-replica4
sudo docker rm kvs-replica4
