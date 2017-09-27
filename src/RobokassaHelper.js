
const crypto = require('crypto');
const url = require('url');
const _ = require('lodash');
const Promise = require('bluebird');
const https = require('https');
const xml2js = require('xml2js');

var parser = new xml2js.Parser({
  trim:true,
  normalize:true,
  normalizeTags:true,
  explicitRoot:false
});
parseString = parser.parseString;

const DEFAULT_CONFIG = {

  // Main parameters.
  merchantLogin: '',
  hashingAlgorithm: 'md5',
  password1: '',
  password2: '',
  testMode: false,
  resultUrlRequestMethod: 'POST',

  // Additional configuration.
  paymentUrlTemplate: 'https://auth.robokassa.ru/Merchant/Index.aspx',
  debug: false,
  userDataKeyPrefix: 'Shp_',

  // List of keys supported in "ResultURL" requests
  // Set to "true" to mark specific key as "required"
  resultUrlKeys: {
    OutSum: true,
    InvId: true,
    SignatureValue: true
  }

};


class RobokassaHelper {

  /**
   * @param {object} config
   */
  constructor (config) {
    this.config = _.extend({}, DEFAULT_CONFIG, config);
  }

  /**
   * @param {number} outSum
   * @param {string} invDesc
   * @param {object} [options]
   *
   * @returns {string}
   */
  generatePaymentUrl (outSum, invDesc, options) {

    const defaultOptions = {
      invId: null,
      email: null,
      outSumCurrency: null,
      userData: {}
    };
    options = _.extend({}, defaultOptions, options || {});

    const values = {
      MerchantLogin: this.config.merchantLogin,
      OutSum: outSum,
      Description: invDesc,
      SignatureValue: this.calculatePaymentUrlHash(outSum, options),
      Encoding: (options.encoding || 'UTF-8')
    };

    // InvId.
    if (options.invId) {
      values.InvId = options.invId;
    }

    // E-Mail.
    if (options.email) {
      values.Email = options.email;
    }

    // OutSumCurrency.
    if (options.outSumCurrency) {
      values.OutSumCurrency = options.outSumCurrency;
    }

    // Is Test.
    if (this.config.testMode || options.isTest) {
      values.IsTest = 1;
    }

    // Custom user data.
    if (options.userData) {
      _.forEach(options.userData, (value, key) => {
        values[this.config.userDataKeyPrefix + key] = value;
      });
    }

    const oUrl = url.parse(this.config.paymentUrlTemplate, true);
    delete oUrl.search;
    _.extend(oUrl.query, values);

    return url.format(oUrl);
  }

  /**
   * @param {float} outSum
   * @param {object} [options]
   *
   * @returns {string}
   */
  calculatePaymentUrlHash (outSum, options) {

    let values = [
      this.config.merchantLogin,
      outSum,
      (options && options.invId ? options.invId : '')
    ];

    if (options.outSumCurrency) {
      values.push(options.outSumCurrency);
    }

    values.push(this.config.password1);

    // Custom user data.
    if (options.userData) {
      let userData = [];
      _.forEach(options.userData, (value, key) => {
        const rkKey = this.config.userDataKeyPrefix + key;
        userData.push(rkKey + '=' + value);
      });
      values = values.concat(userData.sort());
    }

    let hash = this.calculateHash(
      values.join(':')
    );
    console.log(`Values: ${values.join(':')}`)
    console.log(`Hash: ${hash}`)
    return hash;
  }

  /**
   * Express route handler for "ResultURL" callback requests.
   *
   * @param {object} req
   * @param {object} res
   * @param {function} callback
   * @param {object} [options]
   */
  handleResultUrlRequest (req, res, callback, options) {

    if ('function' !== typeof callback) {
      throw new Error('Callback must be a function');
    }

    options = options || {};

    const method = (options.requestMethod || this.config.resultUrlRequestMethod);

    // Selecting request data object according to request method.
    let data = {};
    switch (method.toUpperCase()) {
      case 'GET':
        data = req.query;
        break;
      case 'POST':
        data = req.body;
        break;
    }

    // Validating and parsing request.
    let values = {};
    try {
      const keys = (options.keys || this.config.resultUrlKeys);
      _.forEach(keys, (required, key) => {
        const value = data[key];
        if (!value && required) {
          throw new Error('Missing required key: ' + key);
        }
        if (value) {
          const normKey = _.camelCase(key);
          values[normKey] = value;
        }
      });
    } catch (error) {
      res.status(400).send(error.message);
      return;
    }

    // Extracting user data from request.
    const userData = {};
    const userDataKeyPrefixLowerCased = this.config.userDataKeyPrefix.toLowerCase();
    _.forEach(data, (value, key) => {
      const normKey = key.toLowerCase();
      if (_.startsWith(normKey, userDataKeyPrefixLowerCased)) {
        userData[key] = value;
      }
    });

    // Validating token.
    if (!this.validateResultUrlHash(values.signatureValue, values.outSum, values.invId, userData)) {
      res.status(400).send('Incorrect signature value');
      return;
    }

    const clearedUserData = {};
    if (userData) {
      _.forEach(userData, (value, key) => {
        const clearedKey = key.substr(this.config.userDataKeyPrefix.length);
        clearedUserData[clearedKey] = value;
      })
    }

    // Triggering user callback function.
    Promise.resolve(callback(values, clearedUserData)).then(result => {
      if (false !== result) {
        res.send('OK' + values.invId);
      }
    });

  }

  /**
   * Checks if the passed hash is correct for the passed values.
   *
   * @param {string} hash
   * @param {string} outSum
   * @param {string} invId
   * @param {object} userData
   *
   * @returns {boolean}
   */
  validateResultUrlHash (hash, outSum, invId, userData) {
    return (hash.toLowerCase() == this.calculateResultUrlHash(outSum, invId, userData).toLowerCase());
  }

  /**
   * Calculates hash for ResultURL request.
   *
   * @param {string} outSum
   * @param {string} invId
   * @param {object} userData
   *
   * @returns {string}
   */
  calculateResultUrlHash (outSum, invId, userData) {

    let values = [outSum];

    if (invId) {
      values.push(invId);
    }

    values.push(this.config.password2);

    // Handling user data.
    if (userData) {
      let strings = [];
      _.forEach(userData, (value, rkKey) => {
        strings.push(rkKey + '=' + value);
      });
      values = values.concat(strings.sort());
    }

    return this.calculateHash(
      values.join(':')
    );

  }

  /**
   * Returns string HEX hash of the passed value.
   *
   * @param value
   *
   * @returns {string}
   */
  calculateHash (value) {

    const hash = crypto.createHash(this.config.hashingAlgorithm);

    hash.update(value);

    return hash.digest('hex');

  }

  /**
   * Returns your summ plus service commission
   *
   * @param {number} outSum
   * @param {string} [lang=en]
   * @param [callback]
   *
   */
  calculateCommission (outSum,lang='en',callback){
    return new Promise((resolve,reject)=>{
      if(typeof lang==='function'){
        callback=lang;
        lang='en';
      }
      if(!callback){
        callback = function(err,result){
          if(err) return reject(err);
          return resolve(result);
        };
      }
      if(typeof outSum==='undefined') return callback(new TypeError());

      let req = https.request(`https://auth.robokassa.ru/Merchant/WebService/Service.asmx/GetRates?MerchantLogin=${this.config.merchantLogin}&IncCurrLabel=&OutSum=${outSum}&Language=${lang}`,res=>{
        let body = '';
        res.setEncoding('utf8');
        res.on('data',chunk => {body+=chunk});
        res.on('end', () => {
          parseString(body, (err,parsed)=>{
            if(err) return callback(err);
            try{
              var result = parsed.groups[0].group.map(group=>{
                return {
                  code:group.$.Code,
                  description:group.$.Description,
                  items:group.items[0].currency.map(currency=>{
                    return {
                      label:currency.$.Label,
                      alias:currency.$.Alias,
                      name:currency.$.Name,
                      minValue:currency.$.MinValue,
                      maxValue:currency.$.MaxValue,
                      incSum:currency.rate[0].$.IncSum
                    }
                  })
                };
              });
            }catch(err){
              return callback(err);
            }
            callback(null,result)
          });
        });
      });
      req.on('error',callback);
      req.end();
    })
  }

}

module.exports = RobokassaHelper;
