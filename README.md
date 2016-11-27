feathers-coucdb
================

[![Build Status](https://travis-ci.org/lontongcorp/feathers-couchdb.png?branch=master)](https://travis-ci.org/lontongcorp/feathers-couchdb)

> CouchDB CRUD service for [FeathersJS](http://feathersjs.com) using [cradle](https://github.com/flatiron/cradle)


## Installation

```bash
npm install cradle feathers-couchdb --save
```

## Documentation

Please refer to the [cradle](https://github.com/flatiron/cradle) for more details about connection options and [Feathers database adapter](http://docs.feathersjs.com/databases/readme.html).

#### Getting Started

Create CouchDB service:

```js
var cradle = require('cradle');
var service = require('feathers-couchdb');

var app = feathers();

//var Connection = new(cradle.Connection)('http://192.168.1.79:5984');
var Connection = new(cradle.Connection)(
    'user.cloudant.com', 443,
    {
        secure: true,
        auth: {
            username: 'user',
            password: '<pass>'
        },
        cache: true
    }
);

var opts = {
  connection: Connection,
  Model: 'messages'
};

app.service('/messages', service(opts));
```

This will create a `messages` endpoint and connect to a local `messages` database. Each model represents each database in CouchDB that will created automatically if not exist.


#### Create Document

To insert new document(s), provide an array as body.
```js
[{
	"name": "Luke Skywalker",
	"force": "light"
},{
	"name": "Han Solo",
	"force": "neutral"
},{
	"name": "Yoda",
	"force": "light"
}]
```

For single document, you can provide `_id` as key rather than generated `uuid` by CouchDB.

```js
{
    "_id": "vader",
	"name": "Darth Vader",
	"force": "dark"
}
```

To update and delete you need this `_id`.


#### View

To add `_design` document for view query, create as normal Create Document with `_id` start with `_design`

```js
{
    "_id": "_design/hero",
    "views": {
        "all": {
            "map": "function (doc) { if (doc.name) emit(doc.name, doc); }"
        }
    },
    "validate_doc_update": "function (newDoc, oldDoc, usrCtx) {if (! /^(light|dark|neutral)$/.test(newDoc.force)) throw({forbidden: {error: 'invalid value', reason: 'force must be dark, light, or neutral'}})}"
}
```

will create `.view('_design/hero/_views/all')` map-reduce function.


#### Query

To query data, simply FIND to `_design` document giving its namespace as param `q`

```
/messages/?q=hero/all
```

can also add other params as well `$skip`, `$limit`, `$select`

**NOTE** This plugin also provide *non-designed view* and try to create temporary view inside database. If `_temp_view` option is not available, like cloudant, this will create new view design and remove it immediately after.
Please be aware this process slower than having saved design doc.

```js
{
    "$skip": 0,
    "$limit": 10,
    "$select": ['name', 'force'],
    "$or": [
        { "force": 'light' },
        { "force": 'neutral' },
        {
          "name": {
            "$in": ['han','solo','yoda']
          }
        }
    ]
};
```


#### Limitation

`$sort` is not implemented yet.


###### Credits

*Adapted from original works by FeathersJS team*


## License

Licensed under the [MIT license](LICENSE).
