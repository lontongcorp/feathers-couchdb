import { expect } from 'chai';
import { Connection } from 'cradle';
import feathers from 'feathers';
import service from '../src';
import server from './test-app';

describe('Feathers CouchDB Service', () => {
  const app = feathers();

  let conn, db;

  before(() => {
      conn = new(Connection)();
      db = service({ Model: 'tests', connection:conn }).database();

      app.use('/tests', service({ Model: 'tests', connection:conn }));
  });

  //after( ()=> db.then( db => db.destroy()).catch(()=> this.db.destroy()) );

  it('is CommonJS compatible', () =>
    expect(typeof require('../lib')).to.equal('function')
  );

  describe('Initialization', () => {
    describe('when missing options', () => {
      it('throws an error', () =>
        expect(service.bind(null)).to.throw('CouchDB options have to be provided')
      );
    });

    describe('when missing Connection', () => {
      it('throws an error', () =>
        expect(service.bind(null, {Model:'tests'})).to.throw('You must provide couchdb connection')
      );
    });

    describe('when missing a Model', () => {
      it('throws an error', () =>
        expect(service.bind(null, {connection:conn})).to.throw('You must provide a Model name')
      );
    });

    describe('when missing the paginate option', () => {
      it('sets the default to be {}', () =>
        expect(service({ Model: 'tests', connection:conn }).paginate).to.deep.equal({})
      );
    });

    describe('when couchdb connection provided', () => {
      it('should be equal with conn', () =>
        expect(service({ Model: 'tests', connection:conn }).connection).to.deep.equal(conn)
      );
    });
  });

  describe('CouchDB service example test', () => {
    before(() => server);
    after(done => {
      server.then(s => s.close(() => done()));
    });
  });

});
