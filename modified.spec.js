'use strict';
/* jshint node: true, mocha: true, expr: true */

var expect = require('chai').expect;
var mongoose = require('mongoose');
var faker = require('faker');
var modified = require('./modified');

var connectionString = 'mongodb://' +
  (process.env.MONGO_HOST || 'localhost') +
  (process.env.MONGO_PORT ? ':' + process.env.MONGO_PORT : '') +
  '/unit_test';

var Schema = mongoose.Schema;
var connection;

// Mongoose uses internal caching for models.
// While {cache: false} works with most models, models using references
// use the internal model cache for the reference.
// This removes the mongoose entirely from node's cache
delete require.cache.mongoose;

var userData = {
  username: faker.internet.userName(),
  password: faker.internet.password(),
  name: {first: faker.name.firstName(), last: faker.name.lastName()},
  emails: [faker.internet.email()]
};

// Set Mongoose internal promise object to be the native Promise object
mongoose.Promise = global.Promise;

before(function (done) {
  connection = mongoose.createConnection(connectionString);
  connection.once('connected', done);
});

after(function (done) {
  connection.db.dropDatabase(function (err, result) {
    connection.close(done);
  });
});

describe('Mongoose plugin: modified', function () {
  describe('with plugin declaration', function () {
    var schema;

    beforeEach(function () {
      schema = userSchema();
    });

    it('should add `modified.date` and `modified.by` to the schema', function () {
      schema.plugin(modified);
      expect(schema.pathType('modified.date')).to.equal('real');
      expect(schema.pathType('modified.by')).to.equal('real');
      expect(schema.path('modified.by').instance).to.equal('String');
    });

    it('should add `modified.date` and a reference for `modified.by` to the schema', function () {
      schema.plugin(modified, {by: {ref: 'User'}});
      expect(schema.pathType('modified.date')).to.equal('real');
      expect(schema.pathType('modified.by')).to.equal('real');
      expect(schema.path('modified.by').instance).to.equal('ObjectID');
    });

    it('should add `modifiedBy` and `modifiedDate` to the schema', function () {
      schema.plugin(modified, {by: {path: 'modifiedBy'}, date: {path: 'modifiedDate'}});
      expect(schema.pathType('modifiedDate')).to.equal('real');
      expect(schema.pathType('modifiedBy')).to.equal('real');
    });

    it('should only add `modified.date` to the schema with `by.path` set to `null`', function () {
      schema.plugin(modified, {by: {path: null}});
      expect(schema.pathType('modified.date')).to.equal('real');
      expect(schema.pathType('modified.by')).to.equal('adhocOrUndefined');
    });

    it('should only add `modified.date` to the schema with `by.path` set to empty string', function () {
      schema.plugin(modified, {by: {path: ''}});
      expect(schema.pathType('modified.date')).to.equal('real');
      expect(schema.pathType('modified.by')).to.equal('adhocOrUndefined');
    });

    it('should make `modified.by` required with options', function () {
      schema.plugin(modified, {by: {options: {required: true}}});
      expect(schema.path('modified.by').isRequired).to.be.true;
    });
  });

  describe('with initial document creation', function () {
    var user;

    it('should compile the model with the modified plugin', function () {
      var User;
      var schema = userSchema();
      schema.plugin(modified);

      User = model(schema);
      expect(User).to.be.an.instanceof(Function);

      user = new User(userData);
      expect(user instanceof User).to.be.true;
    });

    it('should not set `modified.date`', function () {
      expect(user.modified.date).to.be.undefined;
    });

    it('should not set `modified.date` on initial save', function () {
      return user.save().then(function (user) {
        expect(user.modified.date).to.be.undefined;
      });
    });
  });

  describe('with document manipulations', function () {
    var User;

    it('should compile the model with the modified plugin', function () {
      var schema = userSchema();
      schema.plugin(modified);

      User = model(schema);
      expect(User).to.be.an.instanceof(Function);
    });

    it('should update `modified.date` on subsequent saves', function () {
      var user = new User(userData);

      return user.save().then(function (user) {
        user.username = faker.internet.userName();

        return user.save().then(function (user) {
          expect(user.modified.date).to.exist;
          expect(user.modified.date).to.be.above(user.created);
        });
      });
    });
  });

  describe('with specific paths', function () {
    var User;

    it('should compile the model with the modified plugin', function () {
      var schema = userSchema();
      schema.path('name.first').options.modified = true;
      schema.plugin(modified);

      User = model(schema);
      expect(User).to.be.an.instanceof(Function);
    });

    it('should not update `modified.date` on saves without matched path modified', function () {
      var user = new User(userData);

      return user.save().then(function (user) {
        user.username = faker.internet.userName();

        return user.save().then(function (user) {
          expect(user.modified.date).to.be.undefined;
        });
      });
    });

    it('should not update `modified.date` on saves without matched path modified', function () {
      var user = new User(userData);

      return user.save().then(function (user) {
        user.name.last = faker.name.lastName();

        return user.save().then(function (user) {
          expect(user.modified.date).to.be.undefined;
        });
      });
    });

    it('should update `modified.date` on saves with matched path modified', function () {
      var user = new User(userData);

      return user.save().then(function (user) {
        user.name.first = faker.name.firstName();

        return user.save().then(function (user) {
          expect(user.modified.date).to.exist;
          expect(user.modified.date).to.be.above(user.created);
        });
      });
    });
  });

  describe('with `modified.by` required', function () {
    var User;
    var userObj;

    it('should compile the model with the modified plugin', function () {
      var schema = userSchema();
      schema.path('name.first').options.modified = true;
      schema.plugin(modified, {by: {options: {required: true}}});

      User = model(schema);
      expect(User).to.be.an.instanceof(Function);
    });

    it('should not require `modified.by` on new documents', function () {
      var user = new User(userData);

      return user.save().then(function (user) {
        expect(user.modified.date).to.be.undefined;
        userObj = user;
      });
    });

    it('should not require `modified.by` on saves without matched path modified', function () {
      userObj.name.last = faker.name.firstName();

      return userObj.save().then(function (user) {
        expect(user.modified.date).to.be.undefined;
        userObj = user;
      });
    });

    it('should require `modified.by` on saves with matched path modified', function () {
      userObj.name.first = faker.name.firstName();

      return userObj.save().then(function () {
        // Shouldn't get here
        throw new Error('Test failed');
      }).catch(function (err) {
        expect(err.errors).to.have.all.keys(['modified.by']);
      });
    });

    it('should update `modified.date` on saves with matched path modified', function () {
      var date = new Date();
      userObj.name.first = faker.name.firstName();
      userObj.modified.by = faker.internet.userName();

      return userObj.save().then(function (user) {
        expect(user.modified.date).to.exist;
        expect(user.modified.date).to.be.above(user.created);
        expect(user.modified.date).to.be.at.least(date);
        userObj = user;
      });
    });

    it('should require `modified.by` be set on subsequent saves with matched path modified', function () {
      userObj.name.first = faker.name.firstName();

      return userObj.save().then(function () {
        // Shouldn't get here
        throw new Error('Test failed');
      }).catch(function (err) {
        expect(err.errors).to.have.all.keys(['modified.by']);
      });
    });

    it('should update `modified.date` on subsequent saves with matched path modified', function () {
      var date = new Date();
      userObj.name.first = faker.name.firstName();
      userObj.modified.by = faker.internet.userName();

      return userObj.save().then(function (user) {
        expect(user.modified.date).to.exist;
        expect(user.modified.date).to.be.above(user.created);
        expect(user.modified.date).to.be.at.least(date);
        userObj = user;
      });
    });

    it('should update `modified.date` on subsequent saves with matched path modified and same value for `modified.by`', function () {
      var date = new Date();
      userObj.name.first = faker.name.firstName();
      userObj.modified.by = userObj.modified.by;

      return userObj.save().then(function (user) {
        expect(user.modified.date).to.exist;
        expect(user.modified.date).to.be.above(user.created);
        expect(user.modified.date).to.be.at.least(date);
        userObj = user;
      });
    });
  });
});

function model(name, schema) {
  if (arguments.length === 1) {
    schema = name;
    name = 'Model';
  }

  // Specifying a collection name allows the model to be overwritten in
  // Mongoose's model cache
  return connection.model(name, schema, name);
}

function userSchema() {
  return new Schema({
    username: String,
    password: String,
    name: {
      first: String,
      last: String
    },
    emails: [String],
    created: {type: Date, 'default': Date.now}
  });
}
