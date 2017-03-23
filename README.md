# bookshelf-entity
[![NPM Version][npm-image]][npm-url] [![Build Status][build-image]][build-url] [![Dependency Status][depstat-image]][depstat-url] [![Dev Dependency Status][devdepstat-image]][devdepstat-url]

Bookshelf plugin for controlling and formatting model serialization/output using [json-entity](https://github.com/joshswan/json-entity). This plugin patches `toJSON` on models and collections to require an Entity to be specified for serialization, and Entities only allow property whitelisting, you have very clear and detailed control over exactly which properties are exposed from your models. Entities also have a wealth of other formatting/modification options so you can make sure your API responses are perfect every time.

## Installation

```javascript
npm install bookshelf-entity --save
```

## Usage

Apply the plugin:
```javascript
bookshelf.plugin('bookshelf-entity');
```

Define an Entity:
```javascript
// You can extend from bookshelf.Entity or install json-entity and use it directly
const UserEntity = bookshelf.Entity.extend({
  id: true,
  firstName: true,
  lastName: true,
  fullName(user) {
    return `${user.firstName} ${user.lastName}`;
  },
  location: { as: 'hometown', if: (user, options) => options.includeLocation },
});
```

Specify Entity when calling `toJSON`:
```javascript
const user = User.forge({
  id: 1,
  firstName: 'Josh',
  lastName: 'Swan',
  location: 'San Francisco, CA',
});

user.toJSON({ entity: UserEntity });
/*
    {
      id: 1,
      firstName: "Josh",
      lastName: "Swan",
      fullName: "Josh Swan",
    }
 */

user.toJSON({ entity: UserEntity }, { includeLocation: true });
/*
    {
      id: 1,
      firstName: "Josh",
      lastName: "Swan",
      fullName: "Josh Swan",
      hometown: "San Francisco, CA"
    }
 */
```

Optional: You can also specify a `defaultEntity` on your model as a fallback when `toJSON` is invoked without specifying an Entity:
```javascript
const User = bookshelf.Model.extend({
  defaultEntity: UserEntity,
});
```

## See [json-entity](https://github.com/joshswan/json-entity) for all available options

[build-url]: https://travis-ci.org/joshswan/bookshelf-entity
[build-image]: https://travis-ci.org/joshswan/bookshelf-entity.svg?branch=master
[depstat-url]: https://david-dm.org/joshswan/bookshelf-entity
[depstat-image]: https://david-dm.org/joshswan/bookshelf-entity.svg
[devdepstat-url]: https://david-dm.org/joshswan/bookshelf-entity#info=devDependencies
[devdepstat-image]: https://david-dm.org/joshswan/bookshelf-entity/dev-status.svg
[npm-url]: https://www.npmjs.com/package/bookshelf-entity
[npm-image]: https://badge.fury.io/js/bookshelf-entity.svg
