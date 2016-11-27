import Proto from 'uberproto';
import filter from 'feathers-query-filters';
import errorHandler from './error-handler';

class Service {
  constructor(options) {
    if (!options) {
      throw new Error('CouchDB options have to be provided');
    }

    if (!options.connection) {
      throw new Error('You must provide couchdb connection');
    }

    if (!options.Model) {
      throw new Error('You must provide a Model name');
    }

    this.id = options.id || '_id';
    this.events = options.events || [];
    this.connection = options.connection;
    this.Model = options.Model.toString().toLowerCase();
    this.paginate = options.paginate || {};

    this.db = this.database();
  }

  database() {
    let db = this.connection.database(this.Model);

    return new Promise((resolve,reject) => {
      db.exists(function (err, exists) {
        if (err) {
            return reject(err);
        }

        if (exists) {
            resolve(db);
        } else {
            db.create((err) => {
                if (err) {
                    if (err.name === 'CouchError' && err.error === 'file_exists') {
                        return resolve(db);
                    }

                    return reject(err);
                }

                resolve(db);
            });
        }
      });
    });
  }

  extend(obj) {
    return Proto.extend(obj, this);
  }

  _createMapRCondition(id, key, query) {
      const self = this,
            METHOD = ['$in','$nin','$ne','$not','$lt','$lte','$gt','$gte'],
            COMPAT = ['.indexOf','.indexOf', '!==', '!==', '<', '<=', '>', '>='];

      if (id===key && id === '$or') {
        let retval = '';

        for (let i=0,N=query.length; i<N; i++) {
          (function(obj){
            for (let k in obj) {
              retval += ' || ' + self._createMapRCondition(k, k, obj[k]);
            }
          }(query[i]));
        }

        return '(' + retval.substr(4) + ')';

      } else if (id===key && typeof query !== 'object') {
          return `doc.${id}==${JSON.stringify(query)}`;
      } else {
          let arr = '';
          for (var k in query) {
              let repl = COMPAT[METHOD.indexOf(k)];
              let qb = `doc.${id}${repl}${query[k]}`;
              if (k === '$in') {
                  qb = `RegExp('${query[k].join('|')}','gi').test(doc.${id})`;
              } else if (k === '$nin') {
                  qb = `!RegExp('${query[k].join('|')}','gi').test(doc.${id})`;
              }
              arr += ' && ' + qb;
          }

          return arr.substr(4);
      }
  }

  // avoid using temporaryView CouchDB, use predefined view!
  _createTempView(filters, query) {
      const self = this;
      //
      let fields = 'doc';
      if (filters.$select) {
          let obj = '_id: doc._id';
              obj += ', _rev: doc._rev';
          for (let i = 0, N = filters.$select.length; i<N; i++) {
              obj += `, ${filters.$select[i]}: doc.${filters.$select[i]}`;
          }
          fields = '{'+obj+'}';
      }

      let conditions  = 'doc';
      for (let key in query) {
        (function(k,v){
          conditions += ' && ' + self._createMapRCondition(k, k, v);
        }(key,query[key]));
      }

      let fnBody = `
      if (${conditions}) {
          emit(null, ${fields});
      }`;

      /*jshint evil: true */
      const fn = new Function('doc', fnBody);

      const FntoString = fn.toString().replace(fn.name,'');
      fn.toString = () => {
          return FntoString.replace(/\r?\n|\/\*\*\/|  /gim,'');
      };

      return fn;
  }

  find(params) {
    const self = this;
    const paginate = (params && typeof params.paginate !== 'undefined') ? params.paginate : this.paginate;

    const q = params.query.q;
    let { filters, query } = filter(params.query|| {}, paginate);

    return this.db.then(db => {
              return new Promise((resolve,reject) => {

                const opts = {
                  limit: filters.$limit || paginate.default || 100,
                  skip: filters.$skip || 0,
                  //descending: filters.$sort === 'desc'
                };

                let promisify = (err, res) => {
                  if (err) {
                      return reject(err);
                  }

                  for (let i=0,N=res.length; i<N; i++) {
                      res[i] = res[i].value;
                      res[i].id = res[i]._id;
                      delete res[i]._id;
                      delete res[i]._rev;

                      const arr = filters.$select;
                      if (arr && Array.isArray(arr) && arr.length>0) {
                          let tmpData = {};

                          for (let j=0,N=arr.length; j<N; j++) {
                              tmpData[arr[j]] = res[i][arr[j]];
                          }
                          res[i] = tmpData;
                      }
                  }

                  resolve(res);
                };

                if (q) {
                    return db.view(q, opts, promisify);
                }

                const viewFn = self._createTempView(filters, query);
                db.temporaryView({
                    map: viewFn
                }, (err,res)=>{
                    if (err) {
                        // try to create new _design view
                        // (ie. Cloudant doesn't allow temporaryView)
                        db.save('_design/feathers', {
                            views: {
                                temp: {  map: viewFn }
                            }
                        }, (err,obj) => {
                            db.view('feathers/temp', opts, (err,res) => {
                                if (err) {
                                  return promisify(err, res);
                                }

                                db.remove('_design/feathers', obj.rev, err => promisify(err, res));
                            });
                        });
                    } else {
                        promisify(err,res);
                    }
                });
              });
            })
            .catch(errorHandler);
  }

  _get(id) {
    return  this.db.then(db => {
              return new Promise((resolve,reject) => {
                db.get(id, (err, res) => {
                    if (err) {
                        return reject(err);
                    }

                    resolve(res);
                });
              });
            });
  }

  get(id, params) {
    return  this._get(id,params)
                .then(res=>{
                  let obj = Object.assign({id: res._id}, res);
                  delete obj._id;
                  delete obj._rev;

                  return obj;
                })
                .catch(errorHandler);
  }

  create(data) {
    let entry, _id;

    // bulk insert
    if (Array.isArray(data)) {
        let N = data.length;
        entry = new Array(N);

        for (let i = 0; i < N; i++) {
            entry[i] = Object.assign({}, data[i]);
        }
    }

    // single doc insert
    else {
        if (data._id || data.id) {
            _id = data._id || data.id;
            data.id = data._id = undefined;
        }
        entry = Object.assign({}, data);

        if (_id && _id.startsWith('_design/')) {
            _id = _id.toLowerCase();
        }
    }

    return  this.db.then(db => {
              return new Promise((resolve,reject) => {
                const promisify = (err, res) => {
                    if (err) {
                        return reject(err);
                    }

                    entry.id = res.id;
                    resolve(entry);
                };

                _id ? db.save(_id, entry, promisify) : db.save(entry, promisify);

              });
            })
            .catch(errorHandler);
  }

  patch(id, data) {
      const self = this;

      return this.db.then(db => {
        return new Promise((resolve,reject) => {
            if (data.id) { delete data.id; }
            if (data._id) { delete data._id; }

            let entry = Object.assign({}, data);

            db.merge(id, entry, err => {
                if (err) {
                    return reject(err);
                }

                resolve(self.get(id));
            });
        });
      })
      .catch(errorHandler);
  }

  update(id, data, params) {
    if(!Array.isArray(data)) {
      return Promise.reject('Not replacing multiple records. Did you mean `patch`?');
    }

    let promises = new Array(data.length);
    for (let i = 0, N = data.length; i < N; i++) {
        promises[i] = this.patch(data[i]._id||data[i].id, data[i], params);
    }

    return Promise.all(promises).catch(errorHandler);
  }

  remove(id, params) {
    let promise;
    params = params || {};

    if (!params.rev && !params._rev) {
        promise = this._get(id).then(doc => {
            params.rev = doc.rev || doc._rev;
            return this.db;
        });
    } else {
        promise = this.db;
    }

    return promise.then(db => {
            return new Promise((resolve,reject) => {
              db.remove(id, params.rev || params._rev, (err, res) => {
                if (err) {
                    return reject(err);
                }

                resolve(res);
              });
            });
          })
          .catch(errorHandler);
  }
}

export default function init(options) {
  return new Service(options);
}

init.Service = Service;
