# 🦜 brig ~ *raft consensus for pirates*

[Raft](https://raft.github.io/raft.pdf) is a crash-fault-tolerant consensus 
algorithm for distributed synchronized state machines. This package provides 
a flexible implementation in plain JavaScript with zero dependencies.

## install

```
npm install @yipsec/brig
```

## usage

```js
const { randomUUID } = require('node:crypto');
const { Client, Server } = require('@yipsec/scarf');
const { events, consensus } = require('@yipsec/brig');

// Give this node an ID
const id = randomUUID();

// Create a brig cluster
const cluster = new consensus.Cluster(id);

// Implement a message receiver
const server = new Server(cluster.createProtocolMapping());
server.listen();

// Simple connection pool example
const pool = new Map();

// Implement a message transmitter
function deliverMsg(id, msg) {
  let client = pool.get(id);

  if (!client) {
    client = new Client();

    client.stream.on('connect', () => {
      pool.set(id, client);
      client.invoke(msg.constructor.method, [msg]);
    }).on('error', (err) => {
      pool.delete(id);
    });

    client.connect(p.port);
  } else {
    client.invoke(msg.constructor.method, [msg]);
  }
}

// Add a peer to the cluster
cluster.addPeer(new consensus.Peer(randomUUID(), deliverMsg));

// Begin cluster bootstrapping
cluster.join();

// Update the cluster log
cluster.broadcast({ key: 'value' });

// Persist log to disk.
cluster.state.serialize(); // Buffer <...>
```

## copying

anti-copyright 2025, yipsec  
licensed lgpl-3.0
