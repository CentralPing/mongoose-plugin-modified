'use strict';

var expect = require('chai').expect;
var mongoose = require('mongoose');
var faker = require('faker');
var _ = require('lodash');
var modified = require('./modified');

var connectionString = process.env.MONGO_URL || 'mongodb://localhost/unit_test';

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

  describe('with document creation', function () {
    var user;

    it('should compile the model with the plugin', function () {
      var User;
      var schema = userSchema();
      schema.plugin(modified);

      User = model(schema);
      expect(User).to.be.an.instanceof(Function);

      user = new User(userData);
      expect(user instanceof User).to.be.true;
    });

    it('should not set `modified.date` on creation', function () {
      expect(user.modified.date).to.be.undefined;
    });

    it('should not set `modified.date` on initial save', function () {
      return user.save().then(function (user) {
        expect(user.modified.date).to.be.undefined;
      });
    });
  });

  describe('with document manipulations', function () {
    var user;

    beforeEach(function () {
      var schema = userSchema();
      var User;
      var newUser;

      schema.plugin(modified);

      User = model(schema);
      newUser = new User(userData);

      return newUser.save().then(function () {
        return User.findById(newUser.id).exec();
      }).then(function(foundUser) {
        user = foundUser;
      });
    });

    it('should update `modified.date` on subsequent saves', function () {
      user.username = faker.internet.userName();

      return user.save().then(function (user) {
        expect(user.modified.date).to.exist;
        expect(user.modified.date).to.be.above(user.created);
      });
    });
  });

  describe('with specific paths', function () {
    var user;

    beforeEach(function () {
      var schema = userSchema();
      var User;
      var newUser;

      schema.path('name.first').options.modified = true;
      schema.plugin(modified);

      User = model(schema);
      newUser = new User(userData);

      return newUser.save().then(function () {
        return User.findById(newUser.id).exec();
      }).then(function(foundUser) {
        user = foundUser;
      });
    });

    it('should not update `modified.date` on saves without matched path modified', function () {
      user.username = faker.internet.userName();

      return user.save().then(function (user) {
        expect(user.modified.date).to.be.undefined;
      });
    });

    it('should not update `modified.date` on saves without matched path modified', function () {
      user.name.last = faker.name.lastName();

      return user.save().then(function (user) {
        expect(user.modified.date).to.be.undefined;
      });
    });

    it('should update `modified.date` on saves with matched path modified', function () {
      user.name.first = faker.name.firstName();

      return user.save().then(function (user) {
        expect(user.modified.date).to.exist;
        expect(user.modified.date).to.be.above(user.created);
      });
    });
  });

  describe('with `modified.by` required', function () {
    var User;
    var user;

    beforeEach(function () {
      var schema = userSchema();
      var newUser;

      schema.path('name.first').options.modified = true;
      schema.plugin(modified, {by: {options: {required: true}}});

      User = model(schema);
      newUser = new User(userData);

      return newUser.save().then(function () {
        return User.findById(newUser.id).exec();
      }).then(function(foundUser) {
        user = foundUser;
      });
    });

    it('should not require `modified.by` on new documents', function () {
      expect(user.modified.date).to.be.undefined;
      expect(user.modified.by).to.be.undefined;
    });

    describe('and without matched path modified', function () {
      it('should not require `modified.by` on save', function () {
        user.name.last = faker.name.firstName();

        return user.save().then(function (savedUser) {
          expect(savedUser.modified.date).to.be.undefined;
          expect(savedUser.modified.by).to.be.undefined;
        });
      });
    });

    describe('and with matched path modified', function () {
      it('should require `modified.by` on save', function () {
        user.name.first = faker.name.firstName();

        return user.save().then(function () {
          // Shouldn't get here
          throw new Error('Test failed');
        }).catch(function (err) {
          expect(err.errors).to.have.all.keys(['modified.by']);
        });
      });

      it('should update `modified.date` on save', function () {
        var date = new Date();
        user.name.first = faker.name.firstName();
        user.modified.by = faker.internet.userName();

        return user.save().then(function (savedUser) {
          expect(savedUser.modified.date).to.exist;
          expect(savedUser.modified.date).to.be.above(user.created);
          expect(savedUser.modified.date).to.be.at.least(date);
        });
      });

      describe('and subsequent saves', function () {
        beforeEach(function () {
          user.name.first = faker.name.firstName();
          user.modified.by = faker.internet.userName();

          return user.save().then(function (savedUser) {
            return User.findById(savedUser.id).exec();
          }).then(function (foundUser) {
            user = foundUser;
          });
        });

        it('should require `modified.by` be set', function () {
          user.name.first = faker.name.firstName();

          return user.save().then(function () {
            // Shouldn't get here
            throw new Error('Test failed');
          }).catch(function (err) {
            expect(err.errors).to.have.all.keys(['modified.by']);
          });
        });

        it('should update `modified.date`', function () {
          var modifiedDate = user.modified.date;
          user.name.first = faker.name.firstName();
          user.modified.by = faker.internet.userName();

          return user.save().then(function (savedUser) {
            expect(savedUser.modified.date).to.exist;
            expect(savedUser.modified.date).to.be.above(modifiedDate);
          });
        });

        it('should update `modified.date` and same value for `modified.by`', function () {
          var modifiedDate = user.modified.date;
          user.name.first = faker.name.firstName();
          user.modified.by = user.modified.by;

          return user.save().then(function (savedUser) {
            expect(savedUser.modified.date).to.exist;
            expect(savedUser.modified.date).to.be.above(modifiedDate);
          });
        });
      });
    });
  });

  describe('with `modified.date` on subdoc schemas', function () {
    var User;

    beforeEach(function () {
      var sub = subSchema();
      var schema;

      sub.plugin(modified);
      schema = userSchema({nicknames: [sub]});

      User = model(schema);
    });

    it('should update `modified.date` on subsequent saves', function () {
      var user = new User(userData);
      user.nicknames.push({name: faker.name.firstName()});

      return user.save().then(function (savedUser) {
        return User.findById(savedUser.id).exec();
      }).then(function (foundUser) {
        foundUser.nicknames[0].name = faker.name.firstName();

        return foundUser.save();
      }).then(function (updatedUser) {
        expect(updatedUser.nicknames[0].modified.date).to.exist;
        expect(updatedUser.nicknames[0].modified.date).to.be.above(updatedUser.nicknames[0].created);
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

function userSchema(sub) {
  var schema = _.defaults({
    username: String,
    password: String,
    name: {
      first: String,
      last: String
    },
    emails: [String],
    created: {type: Date, 'default': Date.now},
  }, sub);

  return new Schema(schema);
}

function subSchema() {
  return new Schema({
    name: String,
    created: {type: Date, 'default': Date.now}
  });
}
