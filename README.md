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
// Example transport layer using passthrough streams.
const { PassThrough } = require('node:stream');

// Example peer IDs using UUID.
const { randomUUID } = require('node:crypto');

// Import the brig/consensus module.
const { events, consensus } = require('@yipsec/brig');

// You must have at least 3 nodes for a valid cluster.
const peer1 = new consensus.Peer(randomUUID(), new PassThrough({
    objectMode: true
}));
const peer2 = new consensus.Peer(randomUUID(), new PassThrough({
    objectMode: true
}));
const peer3 = new consensus.Peer(randomUUID(), new PassThrough({
    objectMode: true
}));

// Each peer is given to a cluster.
const cluster1 = new consensus.Cluster(peer1.id, [peer1, peer2, peer3]).join(); 
const cluster2 = new consensus.Cluster(peer2.id, [peer1, peer2, peer3]).join(); 
const cluster3 = new consensus.Cluster(peer3.id, [peer1, peer2, peer3]).join(); 

// A cluster can broadcast log payloads. They will be synchronized.
cluster1.broadcast({ log: 'entry' });

// The other nodes will have their state updated.
cluster2.state.log.getEntryByIndex(0); // LogEntry <log: 'entry'>
cluster3.state.log.getEntryByIndex(0); // LogEntry <log: 'entry'>

// Persist log to disk.
cluster1.state.serialize(); // Buffer <...>
```

## copying

anti-copyright 2025, yipsec  
licensed lgpl-3.0
