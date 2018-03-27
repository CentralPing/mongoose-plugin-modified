'use strict';

const expect = require('chai').expect;
const mongoose = require('mongoose');
const faker = require('faker');
const _ = require('lodash');
const modified = require('./modified');

const connectionString = process.env.MONGO_URL || 'mongodb://localhost/unit_test';

const Schema = mongoose.Schema;

// Mongoose uses internal caching for models.
// While {cache: false} works with most models, models using references
// use the internal model cache for the reference.
// This removes the mongoose entirely from node's cache
delete require.cache.mongoose;

// Set Mongoose internal promise object to be the native Promise object
mongoose.Promise = global.Promise;

describe('Mongoose plugin: modified', () => {
  const userData = {
    username: faker.internet.userName(),
    password: faker.internet.password(),
    name: {first: faker.name.firstName(), last: faker.name.lastName()},
    emails: [faker.internet.email()]
  };

  let connection;

  before(done => {
    connection = mongoose.createConnection(connectionString);
    connection.once('connected', done);
  });

  after(done => {
    connection.db.dropDatabase(function (err, result) {
      connection.close(done);
    });
  });

  describe('with plugin declaration', () => {
    let schema;

    beforeEach(() => {
      schema = userSchema();
    });

    it('should add `modified.date` and `modified.by` to the schema', () => {
      schema.plugin(modified);
      expect(schema.pathType('modified.date')).to.equal('real');
      expect(schema.pathType('modified.by')).to.equal('real');
      expect(schema.path('modified.by').instance).to.equal('String');
    });

    it('should add `modified.date` and a reference for `modified.by` to the schema', () => {
      schema.plugin(modified, {by: {ref: 'User'}});
      expect(schema.pathType('modified.date')).to.equal('real');
      expect(schema.pathType('modified.by')).to.equal('real');
      expect(schema.path('modified.by').instance).to.equal('ObjectID');
    });

    it('should add `modifiedBy` and `modifiedDate` to the schema', () => {
      schema.plugin(modified, {by: {path: 'modifiedBy'}, date: {path: 'modifiedDate'}});
      expect(schema.pathType('modifiedDate')).to.equal('real');
      expect(schema.pathType('modifiedBy')).to.equal('real');
    });

    it('should only add `modified.date` to the schema with `by.path` set to `null`', () => {
      schema.plugin(modified, {by: {path: null}});
      expect(schema.pathType('modified.date')).to.equal('real');
      expect(schema.pathType('modified.by')).to.equal('adhocOrUndefined');
    });

    it('should only add `modified.date` to the schema with `by.path` set to empty string', () => {
      schema.plugin(modified, {by: {path: ''}});
      expect(schema.pathType('modified.date')).to.equal('real');
      expect(schema.pathType('modified.by')).to.equal('adhocOrUndefined');
    });

    it('should make `modified.by` required with options', () => {
      schema.plugin(modified, {by: {options: {required: true}}});
      expect(schema.path('modified.by').isRequired).to.be.true;
    });
  });

  describe('with document creation', () => {
    let user;

    before(() => {
      const schema = userSchema();
      schema.plugin(modified);

      const User = model(connection, schema);

      user = new User(userData);
    });

    it('should not set `modified.date` on creation', () => {
      expect(user.modified.date).to.be.undefined;
    });

    it('should not set `modified.date` on initial save', () => {
      return user.save({new: true}).then(savedUser => {
        expect(savedUser.modified.date).to.be.undefined;
      });
    });
  });

  describe('with document manipulations', () => {
    let User;
    let user;

    before(() => {
      const schema = userSchema();

      schema.plugin(modified);

      User = model(connection, schema);
    });

    beforeEach(() => {
      const newUser = new User(userData);

      return newUser.save({new: true}).then(savedUser => user = savedUser);
    });

    it('should update `modified.date` on subsequent saves', () => {
      user.username = faker.internet.userName();

      return user.save({new: true}).then(savedUser => {
        expect(savedUser.modified.date).to.exist;
        expect(savedUser.modified.date).to.be.above(user.created);
      });
    });
  });

  describe('with specific paths', () => {
    let User;
    let user;

    beforeEach(() => {
      const schema = userSchema();

      schema.path('name.first').options.modified = true;
      schema.plugin(modified);

      User = model(connection, schema);
    });

    beforeEach(() => {
      const newUser = new User(userData);

      return newUser.save({new: true}).then(savedUser => user = savedUser);
    });

    it('should not update `modified.date` on saves without matched path modified', () => {
      user.username = faker.internet.userName();

      return user.save({new: true}).then(savedUser => {
        expect(savedUser.modified.date).to.be.undefined;
      });
    });

    it('should not update `modified.date` on saves without matched path modified', () => {
      user.name.last = faker.name.lastName();

      return user.save({new: true}).then(savedUser => {
        expect(savedUser.modified.date).to.be.undefined;
      });
    });

    it('should update `modified.date` on saves with matched path modified', () => {
      user.name.first = faker.name.firstName();

      return user.save({new: true}).then(savedUser => {
        expect(savedUser.modified.date).to.exist;
        expect(savedUser.modified.date).to.be.above(user.created);
      });
    });
  });

  describe('with `modified.by` required', () => {
    let User;
    let user;

    before(() => {
      const schema = userSchema();

      schema.path('name.first').options.modified = true;
      schema.plugin(modified, {by: {options: {required: true}}});

      User = model(connection, schema);
    });

    beforeEach(() => {
      const newUser = new User(userData);

      return newUser.save({new: true}).then(savedUser => user = savedUser);
    });

    it('should not require `modified.by` on new documents', () => {
      expect(user.modified.date).to.be.undefined;
      expect(user.modified.by).to.be.undefined;
    });

    describe('and without matched path modified', () => {
      it('should not require `modified.by` on save', () => {
        user.name.last = faker.name.firstName();

        return user.save({new: true}).then(savedUser => {
          expect(savedUser.modified.date).to.be.undefined;
          expect(savedUser.modified.by).to.be.undefined;
        });
      });
    });

    describe('and with matched path modified', () => {
      it('should require `modified.by` on save', () => {
        user.name.first = faker.name.firstName();

        return user.save({new: true}).then(() => {
          // Shouldn't get here
          throw new Error('Test failed');
        }).catch(function (err) {
          expect(err.errors).to.have.all.keys(['modified.by']);
        });
      });

      it('should update `modified.date` on save', () => {
        const date = new Date();
        user.name.first = faker.name.firstName();
        user.modified.by = faker.internet.userName();

        return user.save({new: true}).then(savedUser => {
          expect(savedUser.modified.date).to.exist;
          expect(savedUser.modified.date).to.be.above(user.created);
          expect(savedUser.modified.date).to.be.at.least(date);
        });
      });

      describe('and subsequent saves', () => {
        beforeEach(() => {
          user.name.first = faker.name.firstName();
          user.modified.by = faker.internet.userName();

          return user.save({new: true}).then(savedUser => user = savedUser);
        });

        it('should require `modified.by` be set', () => {
          user.name.first = faker.name.firstName();

          return user.save({new: true}).then(() => {
            // Shouldn't get here
            throw new Error('Test failed');
          }).catch(function (err) {
            expect(err.errors).to.have.all.keys(['modified.by']);
          });
        });

        it('should update `modified.date`', () => {
          const modifiedDate = user.modified.date;
          user.name.first = faker.name.firstName();
          user.modified.by = faker.internet.userName();

          return user.save({new: true}).then(savedUser => {
            expect(savedUser.modified.date).to.exist;
            expect(savedUser.modified.date).to.be.above(modifiedDate);
          });
        });

        it('should update `modified.date` and same value for `modified.by`', () => {
          const modifiedDate = user.modified.date;
          user.name.first = faker.name.firstName();
          user.modified.by = user.modified.by;

          return user.save({new: true}).then(savedUser => {
            expect(savedUser.modified.date).to.exist;
            expect(savedUser.modified.date).to.be.above(modifiedDate);
          });
        });
      });
    });
  });

  describe('with `modified.date` with subdocs', () => {
    let User;

    before(() => {
      const sub = subSchema();

      const schema = userSchema({nicknames: [sub]});
      schema.plugin(modified);

      User = model(connection, schema);
    });

    it('should update `modified.date` on subsequent saves', () => {
      const user = new User(userData);
      user.nicknames.push({name: faker.name.firstName()});

      return user.save({new: true}).then(savedUser => {
        savedUser.nicknames[0].name = faker.name.firstName();

        return savedUser.save({new: true});
      }).then(savedUser => {
        expect(savedUser.modified.date).to.exist;
        expect(savedUser.modified.date).to.be.above(user.created);
      });
    });
  });

  xdescribe('with `modified.date` on subdoc schemas', () => {
    // Disabled due to issue https://github.com/Automattic/mongoose/issues/5861
    let User;

    before(() => {
      const sub = subSchema();
      sub.plugin(modified);

      const schema = userSchema({nicknames: [sub]});

      User = model(connection, schema);
    });

    it('should update `modified.date` on subsequent saves', () => {
      const user = new User(userData);
      user.nicknames.push({name: faker.name.firstName()});

      return user.save({new: true}).then(savedUser => {
        savedUser.nicknames[0].name = faker.name.firstName();

        return savedUser.save({new: true});
      }).then(savedUser => {
        expect(savedUser.nicknames[0].modified.date).to.exist;
        expect(savedUser.nicknames[0].modified.date).to.be.above(user.nicknames[0].created);
      });
    });
  });
});

function model(connection, name, schema) {
  if (arguments.length === 2) {
    schema = name;
    name = 'Model';
  }

  // Specifying a collection name allows the model to be overwritten in
  // Mongoose's model cache
  return connection.model(name, schema, name);
}

function userSchema(sub) {
  const schema = _.defaults({
    username: String,
    password: String,
    name: {
      first: String,
      last: String
    },
    emails: [String],
    created: {type: Date, default: Date.now},
  }, sub);

  return new Schema(schema);
}

function subSchema() {
  return new Schema({
    name: String,
    created: {type: Date, default: Date.now}
  });
}
