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
      db = service({ Model: 'tests', connection:conn });

      app.service('tests', service({ Model: 'tests', connection:conn }));
  });

  //after( ()=> db.then( db => db.destroy()).catch(()=> this.db.destroy()) );

  it('is CommonJS compatible', () =>
    expect(typeof require('../lib')).to.equal('function')
  );

  describe('Initialization:', () => {
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

  describe('CouchDB service example test:', () => {
    before(() => server);

    describe('insert single data', () => {
      it('should return data object', () => {
        return app.service('tests').create({message:'test messages'})
                  .then(obj => expect(typeof obj).to.equal('object'));
      });
    });

    describe('insert multiple data', () => {
      it('should return data array', () => {
        return app.service('tests').create([{message:'test message'}, {message: 'another message'}])
                  .then(obj => expect(Array.isArray(obj)).to.equal(true));
      });
    });

    describe('query all documents from database', () => {
      it('should return data array', () => {
        return app.service('tests').find({query:{}})
                  .then(obj => expect(Array.isArray(obj)).to.equal(true));
      });
    });

    describe('find with key:value from database', () => {
      it('should return data array', () => {
        return app.service('tests').find({ query:{ message:'test message' } })
                  .then(obj => expect(Array.isArray(obj)).to.equal(true));
      });
    });

    describe('drop database', () => {
      it('should return true', () => {
          db = conn.database('tests');
          db.destroy((err,res) => expect(res.ok).to.equal(true));
      });
    });
    
    after(done => {
      server.then(s => s.close(() => done()));
    });
  });

});
