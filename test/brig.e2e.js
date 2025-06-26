'use strict';

const { Client, Server } = require('@yipsec/scarf');
const { randomUUID } = require('node:crypto');
const { expect } = require('chai');
const { events, consensus } = require('..');


describe('@module brig/consensus', function() {

  const NODES = 12;
  const IDS = [];
  const SERVERS = [];
  const PEERS = [];
  const CLUSTERS = [];

  before(async function() {
    for (let i = 0; i < NODES; i++) {
      const id = randomUUID();
      IDS.push(id);

      const cluster = new consensus.Cluster(id);
      CLUSTERS.push(cluster);

      const server = new Server(cluster.createProtocolMapping());
      server.listen();
      SERVERS.push(server);
    }

    SERVERS.forEach(s => {
      PEERS.push(s.server.address());
    });
 
    for (let c = 0; c < CLUSTERS.length; c++) {
      //really verbose logs
      if (process.env.DEBUG) {
        CLUSTERS[c].on(events.Debug, messages => {
          console.log(
            `[ ${CLUSTERS[c].id} ]`,
            ...messages
          );
        });
      }

      const pool = new Map();

      PEERS.forEach((p, i) => {
        if (CLUSTERS[c].id === IDS[i]) {
          return;
        }
        CLUSTERS[c].addPeer(new consensus.Peer(IDS[i], (id, msg) => {
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
        }));
      });
    } 
  });

  describe('~Cluster', function() {

    it('creates a valid instance', function() {
      expect(CLUSTERS[0]).to.be.instanceOf(consensus.Cluster);
    }); 

    it('elect a leader', function(done) {
      CLUSTERS[0].once(events.LeaderChanged, done);
      
      for (let i = 0; i < CLUSTERS.length; i++) {
        CLUSTERS[i].join();
      }
    });
 
    it('can sync state transitions from all nodes', function(done) {
      for (let i = 0; i < CLUSTERS.length; i++) {
        CLUSTERS[i].broadcast({ publisher: CLUSTERS[i].id });
      }
      setTimeout(() => {
        CLUSTERS.forEach(c => {
          expect(c.state.log.entries).to.have.lengthOf(CLUSTERS.length);
        });
        done();
      }, 1400);
    });

  });

  after(function() {
    const { inspect } = require('node:util');

    console.log(CLUSTERS.map(c => { 
      return {
        id: c.id, 
        role: c.state.currentRole 
      }
    }));

    console.log(CLUSTERS.map(c=>c.state.currentLeader));

    console.log(inspect(CLUSTERS.map(c => c.state.log), false, null));
  });

});
