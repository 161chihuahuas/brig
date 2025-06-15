'use strict';

const { expect } = require('chai');
const { log, roles } = require('..');


describe('@module brig/log', function() {

  describe('~Log', function() {

    it('throws on invalid log entry', function() {
      const _log = new log.Log();
      expect(function() {
        _log.append(undefined);
      }).to.throw(TypeError);
    });

  });

  describe('~LogState', function() {

    it('throws on invalid term', function() {
      const logState = new log.LogState();
      expect(function() {
        logState.currentTerm = undefined;
      }).to.throw(TypeError);
    });

    it('throws on invalid role', function() {
      const logState = new log.LogState();
      expect(function() {
        logState.setCurrentRole(undefined);
      }).to.throw(Error);
    });

    let buf;

    it('serializes to a json buffer', function() {
      const logState = new log.LogState();
      logState.currentTerm = 1312;
      logState.setCurrentRole(roles.Candidate);
      logState.log.append(new log.LogEntry({
        initial: 'commit'
      }, 161));
      buf = logState.serialize();
      console.log(buf.toString())
      expect(buf.toString()).to.equal('{"currentTerm":1312,"votedFor":null,"currentLeader":null,"votesReceived":[],"log":[{"payload":{"initial":"commit"},"term":161}],"commitLength":0,"sentLength":[],"ackedLength":[]}');
    });

    it('deserializes from a json buffer', function() {
      const logState = log.LogState.deserialize(buf);
      expect(logState.currentTerm).to.equal(1312);
      expect(logState.log.getEntryByIndex(0).payload.initial).equal('commit');
    });

  });

});
