'use strict';
/* jshint node: true, mocha: true, expr: true */

var expect = require('chai').expect;
var mongoose = require('mongoose');
var faker = require('faker');
var modified = require('./modified');
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

before(function (done) {
  connection = mongoose.createConnection('mongodb://localhost/unit_test');
  connection.once('connected', function () {
    done();
  });
});

after(function (done) {
  connection.db.dropDatabase(function (err, result) {
    connection.close(function () {
      done();
    });
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
      //expect(User).toEqual(jasmine.any(Function));

      user = new User(userData);
      expect(user instanceof User).to.be.true;
    });

    it('should not set `modified.date`', function () {
      expect(user.modified.date).to.be.undefined;
    });

    it('should not set `modified.date` on initial save', function (done) {
      user.save(function (err, user) {
        expect(user.modified.date).to.be.undefined;
        done();
      });
    });
  });

  describe('with document manipulations', function () {
    var User;

    it('should compile the model with the modified plugin', function () {
      var schema = userSchema();
      schema.plugin(modified);

      User = model(schema);
      //expect(User).toEqual(jasmine.any(Function));
    });

    it('should update `modified.date` on subsequent saves', function (done) {
      var user = new User(userData);
      user.save(function (err, user) {
        user.username = faker.internet.userName();

        user.save(function (err, user) {
          expect(user.modified.date).to.exist;
          expect(user.modified.date).to.be.above(user.created);
          done();
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
      //expect(User).toEqual(jasmine.any(Function));
    });

    it('should not update `modified.date` on saves without matched path modified', function (done) {
      var user = new User(userData);
      user.save(function (err, user) {
        user.username = faker.internet.userName();

        user.save(function (err, user) {
          expect(user.modified.date).to.be.undefined;
          done();
        });
      });
    });

    it('should not update `modified.date` on saves without matched path modified', function (done) {
      var user = new User(userData);
      user.save(function (err, user) {
        user.name.last = faker.name.lastName();

        user.save(function (err, user) {
          expect(user.modified.date).to.be.undefined;
          done();
        });
      });
    });

    it('should update `modified.date` on saves with matched path modified', function (done) {
      var user = new User(userData);
      user.save(function (err, user) {
        user.name.first = faker.name.firstName();

        user.save(function (err, user) {
          expect(user.modified.date).to.exist;
          expect(user.modified.date).to.be.above(user.created);
          done();
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
      //expect(User).toEqual(jasmine.any(Function));
    });

    it('should not require `modified.by` on new documents', function (done) {
      var user = new User(userData);
      user.save(function (err, user) {
        userObj = user;
        expect(err).to.be.null;
        expect(user.modified.date).to.be.undefined;
        done();
      });
    });

    it('should not require `modified.by` on saves without matched path modified', function (done) {
      userObj.name.last = faker.name.firstName();

      userObj.save(function (err, user) {
        expect(err).to.be.null;
        expect(user.modified.date).to.be.undefined;
        userObj = user;
        done();
      });
    });

    it('should require `modified.by` on saves with matched path modified', function (done) {
      userObj.name.first = faker.name.firstName();

      userObj.save(function (err, user) {
        expect(err).not.to.be.null;
        expect(err.errors).to.have.all.keys(['modified.by']);
        expect(user).to.be.undefined;
        done();
      });
    });

    it('should update `modified.date` on saves with matched path modified', function (done) {
      var date = new Date();
      userObj.name.first = faker.name.firstName();
      userObj.modified.by = faker.internet.userName();

      userObj.save(function (err, user) {
        expect(user.modified.date).to.exist;
        expect(user.modified.date).to.be.above(user.created);
        expect(user.modified.date).to.be.at.least(date);
        userObj = user;
        done();
      });
    });

    it('should require `modified.by` be set on subsequent saves with matched path modified', function (done) {
      userObj.name.first = faker.name.firstName();

      userObj.save(function (err, user) {
        expect(err).not.to.be.null;
        expect(err.errors).to.have.all.keys(['modified.by']);
        expect(user).to.be.undefined;
        done();
      });
    });

    it('should update `modified.date` on subsequent saves with matched path modified', function (done) {
      var date = new Date();
      userObj.name.first = faker.name.firstName();
      userObj.modified.by = faker.internet.userName();

      userObj.save(function (err, user) {
        expect(user.modified.date).to.exist;
        expect(user.modified.date).to.be.above(user.created);
        expect(user.modified.date).to.be.at.least(date);
        userObj = user;
        done();
      });
    });

    it('should update `modified.date` on subsequent saves with matched path modified and same value for `modified.by`', function (done) {
      var date = new Date();
      userObj.name.first = faker.name.firstName();
      userObj.modified.by = userObj.modified.by;

      return userObj.save(function (err, user) {
        expect(user.modified.date).to.exist;
        expect(user.modified.date).to.be.above(user.created);
        expect(user.modified.date).to.be.at.least(date);
        userObj = user;
        done();
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
