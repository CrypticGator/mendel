
var someMathOperation = require('./math');
var oneNumber = require('./some-number')
var anotherNumber = require('./another-number')

var result = someMathOperation(oneNumber(), anotherNumber());
if (module.parent) {
    module.exports = function() { return result; }
} else {
    console.log(result);
}
