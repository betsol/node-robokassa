
# node-robokassa

[![npm version](https://badge.fury.io/js/node-robokassa.svg)](http://badge.fury.io/js/node-robokassa)

[Robokassa API](http://docs.robokassa.ru/) integration for Node.js.


## Features

- Generates properly signed payment URLs
- Handles "ResultURL" callback requests
- Supports multiple hash function types
- Supports custom transaction parameters (handles `Shp_` prefixes automatically for you)
- Supports "test" mode
- Highly customizable
- Object-oriented interface with code in ES6 and promises support
- Very lightweight with minimal dependencies


## Installation

### Install library with *npm*

`npm i -S node-robokassa`


## Usage

Please see the example below.

### Example

```js

// 1. CREATING NEW INSTANCE

const robokassa = require('node-robokassa');

const robokassaHelper = new robokassa.RobokassaHelper({
  
  // REQUIRED OPTIONS:
  merchantLogin: 'your-merchant-login',
  hashingAlgorithm: 'sha256',
  password1: 'your-first-password',
  password2: 'your-second-password',
  
  // OPTIONAL CONFIGURATION
  testMode: false, // Whether to use test mode globally
  resultUrlRequestMethod: 'POST' // HTTP request method selected for "ResultURL" requests
  
});


// 2. GENERATING PAYMENT URL

// Required parameters.
const outSum = 100.17;
const invDesc = 'Custom transaction description message';

// Optional options.
const options = {
  invId: 100500, // Your custom order ID
  email: 'email@example.com', // E-Mail of the paying user
  outSumCurrency: 'USD', // Transaction currency
  isTest: true, // Whether to use test mode for this specific transaction
  userData: { // You could pass any additional data, which will be returned to you later on
    productId: '1337',
    username: 'testuser'
  }
};

const paymentUrl = robokassaHelper.generatePaymentUrl(outSum, invDesc, options);

// "paymentUrl" will look like: "https://auth.robokassa.ru/Merchant/Index.aspx..."


// 3. HANDLING "ResultURL" CALLBACK REQUEST

module.exports = function (req, res) {

  robokassaHelper.handleResultUrlRequest(req, res, function (values, userData) {
    
    console.log({
      values: values, // Will contain general values like "invId" and "outSum"
      userData: userData // Will contain all your custom data passed previously, e.g.: "productId"
    });
    
    // You could return "false" here in order to throw error instead of success to Robokassa.
    // return false;
    
    // You could also return promise here.
    // return Promise.resolve();
    
  });

};

```

Feel free to browse the source code for more options and API explanation.
It should be very easy to read, I promise.


## API

@todo


## Changelog

Please see the [changelog][changelog] for list of changes.


## Feedback

If you have found a bug or have another issue with the library —
please [create an issue][new-issue].

If you have a question regarding the library or it's integration with your project —
consider asking a question at [StackOverflow][so-ask] and sending me a
link via [E-Mail][email]. I will be glad to help.

Have any ideas or propositions? Feel free to contact me by [E-Mail][email].

Cheers!


## FAQ

@todo


## Developer guide

Fork, clone, create a feature branch, implement your feature, cover it with tests, commit, create a PR.

Run:

- `npm i` to initialize the project


## Support

If you like this library consider to add star on [GitHub repository][repo-gh].

Thank you!


## License

The MIT License (MIT)

Copyright (c) 2016 Slava Fomin II, BETTER SOLUTIONS

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

  [changelog]: changelog.md
  [so-ask]:    http://stackoverflow.com/questions/ask?tags=node.js,javascript
  [email]:     mailto:s.fomin@betsol.ru
  [new-issue]: https://github.com/betsol/node-robokassa/issues/new
  [repo-gh]:   https://github.com/betsol/node-robokassa
