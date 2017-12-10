(function(){
  const BN = require('bignumber.js');
  var LAST_COMPUTED_ALPH = "";
  // Precomputed bases to help out, specifically base16 for hex, base58 for bitcoin and base64 for blobs.
  const BASES = {
    BASE_2: "01",
    BASE_8: "01234567",
    BASE_11: "0123456789a",
    BASE_16: "0123456789abcdef",
    BASE_32: "0123456789ABCDEFGHJKMNPQRSTVWXYZ",
    BASE_36: "0123456789abcdefghijklmnopqrstuvwxyz",
    BASE_52: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP",
    BASE_58: "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvqxyz",
    BASE_62: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    BASE_64: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
    BASE_66: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~",
    BASE_95: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/~!@#$%^&*()_`<>,.?'\";:[{]}\\|=- ",
    FALL_BACK: function(max_i){
      let res = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/~!@#$%^&*()_`<>,.?'\";:[{]}\\|=- ";
      if(LAST_COMPUTED_ALPH.length >= max_i) return LAST_COMPUTED_ALPH.slice(0, max_i);
      if(res.length >= max_i) return res.slice(0, max_i);
      // If the precomputations didnt help pump them up by looping through unicode.
      // With this new code we go up past base 1 million by default :)
      return LAST_COMPUTED_ALPH = [...Array(max_i+48).keys()].slice(48).map(_=>String.fromCharCode(_))
    }
  };
  // Retrieve the proper alphabet for use in conversiosn.
  const alphabet = a => {
    if(typeof a === 'string')
      return a === 'poker' ? BASE_POKER : a;
    else if(BASES['BASE_' + a]) return BASES['BASE_' + a];
    else {
      return BASES.FALL_BACK(a);
    }
  };
  // Our own add function to circumvent javascripts 64bit floating cap.
  const add = (num1, num2, base) => {
    // Our core buffer.
    var res = [], carry = BN(0), total = BN(0), i = 0;
    while(!carry.isZero() || i < num1.length || i < num2.length) {
      total = carry.plus(num1[i]||0).plus(num2[i]||0);
      res[i++] = total.mod(base);
      // Modulous devision to swap bases. newNum = remainder concatinated with the remainders remainder and so on.
      carry = total.minus(total.mod(base)).div(base)
    }
    return res
  };
  // Extend the addition function to introduce multiplications.
  const multiply = (num, exponent, base) => {
    if(num <= 0) return num === 0 ? [] : 0;
    num = BN(num);
    var result = [];
    while(true) {
      // Bit shit to the right and keep doubling the exponent
      num & 1 && (result = add(result, exponent, base)); // First iteration will be 1.
      num = num >> 1;
      if(num === 0) break;
      exponent = add(exponent, exponent, base) // double.
    }
    return result
  };
  // Swap out to buffers to avoid memory limits.
  const stringToNumberArray = (str, baseAlphabet) => {
    var charValues = str.split('');
    var res = [];
    var j = 0;
    for(let i = charValues.length - 1; i >= 0; i--) {
      var n = baseAlphabet.indexOf(charValues[i]);
      if(n < 0) throw new Error("Your data is not found in your alphabet.");
      res[j++] = BN(n);
    }
    return res
  };
  // Conversion begins here.
  const convertBase = (str, fromAlphabet, toAlphabet) => {
    var fromBase = fromAlphabet.length,
    toBase = toAlphabet.length,
    charValues = stringToNumberArray(str.toString(), fromAlphabet); // coerce numbers to string
    if(charValues === null) return null;
    var resNumbers = [], exp = [1];
    for(let i = 0; i < charValues.length; ++i) {
      resNumbers = add(resNumbers, multiply(charValues[i], exp, toBase), toBase);
      exp = multiply(fromBase, exp, toBase)
    }
    // And ends here.
    var res = '';
    if(!resNumbers.length) {
      let i = str.length;
      while(i--)
        // The stream being encoded was pure zeros.
        res += toAlphabet[0]
    } else {
      let i = resNumbers.length;
      while(i--)
        res += toAlphabet[resNumbers[i]]
    }
    return res
  };
  const check = a => {
      if(a.split("").sort().join("").match(/(.)\1/g)) // Check for duplicates.
        throw new Error("Your alphabet must contain all unique charachters.");
      return a
  };
  function converter(ia = null, oa = null) {
    const p = new Proxy({
      // Our API.
      fromXXXToYYY: "Functions to encode and decode.",
      setGlobalAlphabet: "Set both from and to alphabet.",
      setFromAlphabet: "Sets the from alphabet.",
      setToAlphabet: "Set the to alphabet.",
      resetAlphabets: "Resets the alhabets to default.",
    }, {
      get(t, cmd) { // t is our target
        try { if(!(cmd += "")) return } catch(e) { return } // Hack to drop loading errors. And coerce to string.
        // Regex parse for configuration requests.
        if(/^dumpAlphabets$/i.test(cmd)) return function() {
          require('fs').writeFileSync('encode-x_dumpAlphabets', 'Last Computed Alphabet\n'+LAST_COMPUTED_APLPH+'\n\nFrom Alphabet\n'+t.incAlphabet+'\n\nTo Alphabet\n'+t.outAlphabet);
          return this
        }
        if(/^resetAlphabets$/i.test(cmd)) return function() {
          t.incAlphabet = t.outAlphabet = null;
          return this
        }
        if(/^SetGlobalAlphabet$/i.test(cmd)) return function(ga) {
          t.incAlphabet = t.outAlphabet = check(ga)
          return this
        }
        if(/^SetFromAlphabet$/i.test(cmd)) return function(fa) {
          if(ta.split(' ').length > 1) {
            t.incAlphabet = ta.split(' ');
            return this
          }
          t.incAlphabet = alphabet(fa);
          return this
        }
        if(/^SetToAlphabet$/i.test(cmd)) return function(ta) {
          if(ta.split(' ').length > 1) {
            t.outAlphabet = ta.split(' ');
            return this
          }
          t.outAlphabet = alphabet(ta);
          return this
        }
        // Flags
        var outIsData = srcIsData = false;
        // Old regex was /^[x20-x7e]+$/ -- ascii, Even older was /^[\x00-\xff]*$/ -- extended ascii (x7f is 'del')
        var cmds = '(?:\\d+|hex(?:idecimal)?|data|utf8|text|oct(?:al)?|bin(?:ary)?|oth(?:er)?|btc|bitcoin|(?:(?:b(?:ase)?)?(?:\\d+))?blob)';
        var cmdRe = new RegExp('from(' + cmds + ')to(' + cmds + ')', 'i');
        var matches = cmd.match(cmdRe);
        if(!matches) return;
        // Parse for request to encode/decode.
        else if(/data|utf8|oth|text/i.test(matches[1])) { matches[1] = 16; srcIsData = true }
        else if(/data|utf8|oth|text/i.test(matches[2])) { matches[2] = 16; srcIsData = true }
        var checker, possibles = ['hex', 16, 'btc', 58, 'bitcoin', 58, 'blob', 64, 'bin', 2, 'oct', 8];
        if(checker = possibles.indexOf(matches[1].toLowerCase()) > 0) matches[1] = possibles[checker+1];
        if(checker = possibles.indexOf(matches[2].toLowerCase()) > 0) matches[2] = possibles[checker+1];
        // Our only 'public' facing function.
        return function(src) {
          if(+matches[1] === 64 && +matches[2] === 16 && Buffer) return Buffer.from(src, 'base64').toString('hex');
          if(+matches[1] === 16 && +matches[2] === 64 && Buffer) return Buffer.from(src, 'hex').toString('base64');
          var a1, a2;
          // Begin alphabet configuration.
          if(srcIsData) {
            // Our source is not a number, so represent it as one.
            src = Buffer.from(src).toString('hex');
            a1 = alphabet(16);
          } else if(outIsData) {
            a2 = alphabet(16)
          }
          !a1 && (a1 = t.incAlphabet ? t.incAlphabet.slice(0, matches[1]) : alphabet(+matches[1]));
          !a2 && (a2 = t.outAlphabet ? t.outAlphabet.slice(0, matches[2]) : alphabet(+matches[2]));
          if(!srcIsData && matches[1] > a1.length) {
            throw new Error("From alphabet not long enough, consider manually setting a larger one via `setFromAlphabet`.")
          }
          if(!outIsData && matches[2] > a2.length) {
            throw new Error("To alphabet not long enough, consider manually setting a larger one via `setToAlphabet`.")
          }
          // If our output is not to be a number, assume its text/utf8..
          // So this needs to be modified or the output for UTF8 wont work on browsers (They dont have Buffer defined yet...)
          return outIsData ? Buffer.from(convertBase(src, a1, a2), 'hex').toString('utf8') : convertBase(src, a1, a2)
        }
      }
    })
    ia && (p.incAlphabet = ia);
    oa && (p.outAlphabet = oa);
    return p
  }
  // Try to ensure compatibility accross browsers and node.
  try { module.exports = converter } catch(e) { window.converter = converter }

})();
