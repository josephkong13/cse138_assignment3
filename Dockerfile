FROM node:18.13.0

WORKDIR /app

COPY package*.json ./

RUN apt-get update
RUN apt-get install -y iptables

RUN npm install

COPY . .

ENV PORT=13800

EXPOSE 13800

CMD [ "npm", "start" ]
