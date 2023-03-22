#! /bin/bash -x

nth () {
    echo $1 | cut -d " " -f $2 | grep -o -E "[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+"
}

ips=$( cat metadata/ips.txt )
cmds=""
for i in ${@:2}; do
    cmds+="iptables -A INPUT -s $( nth "$ips" $i ) -j DROP\n iptables -A OUTPUT -s $( nth "$ips" $i ) -j DROP\n "
done

printf "$cmds" | sudo docker exec -i --privileged kvs-replica$1 bash