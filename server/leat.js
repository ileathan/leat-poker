// Commands:
//   None.
//
// Author:
//   leathan
//
(function() {
  // Our debug level (will depreciate for --inspect)
  const DEBUG = process.env.DEBUG
  ;
  // For authy apps and such.
  const qrcode = require('qrcode')
  ;
  // 2fa
  const TFA = require('speakeasy')
  ;
  // Quick guest hash ip-auth
  const md5 = require('md5')
  ;
  const SERVER_ROOT = '/../node_modules/hubot-server/public/leat.html'
  ;
  const DATABASE_ENDPOINT = 'mongodb://localhost/gambler-api'
  ;
  // Used for storing cookie data on db.
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY.slice(0, 32)
  ;
  // Depreciated, but still used in static salts.
  const SECRET = process.env.SECRET;
  // These currently map to a random online user id.
  const LEGACY_ENDPOINTS = ['/chat', '/miner', '/gamble'];
  // Users which are unrefferable
  const SEED_USERS = 77;


  const users = {}
    , cookieToUsername = {}
    , usernameToSocket = {}
    , usernameTo2fa = {}
  ;

  global.self = {
    users,
    cookieToUsername,
    usernameToSocket,
    usernameTo2fa
  }
  ;

  // Easy http requests.
  const request = require('request')
  ;
  // Used to access monero daemon.
  const exec = require('child_process').exec
  ;
  // Our db.
  const mongoose = require('mongoose')
  ;
  // OS independant path resolves.
  const path = require('path')
  ;
  // For encryption.
  const crypto = require('crypto')
  ;
  // Our password / data hashers.
  const argonp = require('argon2-ffi').argon2i
  ;
  const argond = require('argon2-ffi').argon2d
  ;
  // Our salter.
  const salt = () => crypto.randomBytes(77)
  ;
  // Infinite base encoder I made and maintain.
  const c = require('encode-x')()
  ;
  Object.assign(self, {c})
  ;

  // $argon2i$v=19$m=7777,t=77,p=77$user.date + crypto.randomBytes + $ + hash
  // Memory cost 7777 KiB (1024*7777), relative time cost, and the number 
  // of threads sustained and concurrent threads needed.
  const ARGON_PCONF = {
    parallelism: 77,
    memoryCost: 7777,
    timeCost: 77
  };



  // Begin mongoose schematic configuration.
  mongoose.Promise = global.Promise;

  const conn = mongoose.createConnection(DATABASE_ENDPOINT);

  const BlockChainSchema = new mongoose.Schema({
    'share': String,
    'salt': String,
    'previousBlockHash': String,
    'hash': String,
  });
  const PokerGamesSchema = new mongoose.Schema({
    'status': Number,
    'players': Object,
    'config': Object,
    'index': Number,
    // In the chain of shares that seaded game sequences.
    'share': String,
  });
  const SharesFoundSchema = new mongoose.Schema({
    'workerId': String,
    'result': String,
    'username': String,
    'jobid': String,
    'nonce': String,
  });
  const TransactionsSchema = new mongoose.Schema({
    'from': String,
    'to': String,
    'amount': Number,
    'type': String,
  });
  const ChatMessagesSchema = new mongoose.Schema({
    'username': String,
    'message': String,
  });
  const UsersSchema = new mongoose.Schema({
    'username': String,
    'loginCookies': Array,
    'password': String,
    'tfa': Boolean,
    'wallet': String,
    'balance': {
      type: Number,
      default: 0
    },
    'ref': Number,
    'isMiningFor': String,
    'refPayments': {
      type: Number,
      default: 0
    },
    'refPaymentsReceived': {
      type: Number,
      default: 0
    },
    'minedPayments': {
      type: Number,
      default: 0
    },
    'minedPaymentsReceived': {
      type: Number,
      default: 0
    },
    'id': Number,
    'shares': {
      type: Number,
      default: 0
    },
    'sharesFound': {
      type: Number,
      default: 0
    },
    'miningConfig': Object,
  });
  // Beautiful hack to allow hotreloading.

  const BlockChain = conn.models.BlockChain || conn.model('BlockChain', BlockChainSchema);
  const PokerGames = conn.models.PokerGames || conn.model('PokerGames', PokerGamesSchema);

  const SharesFound = conn.models.SharesFound || conn.model('SharesFound', SharesFoundSchema);
  const Transactions = conn.models.Transactions || conn.model('Transactions', TransactionsSchema);
  const ChatMessages = conn.models.ChatMessages || conn.model('ChatMessages', ChatMessagesSchema);
  const Users = conn.models.Users || conn.model('Users', UsersSchema);

/**********************************************
*   _____ _             _                     *
*  / ____| |           | |                    *
* | (___ | |_ _ __ __ _| |_ _   _ _ __ ___    *
*  \___ \| __| '__/ _` | __| | | | '_ ` _ \   *
*  ____) | |_| | | (_| | |_| |_| | | | | | |  *
* |_____/ \__|_|  \__,_|\__|\__,_|_| |_| |_|  *
*                                             *
**********************************************/

  var leatProxy = require('leat-stratum-proxy');

  const fs = require('fs')

  leatProxy = new leatProxy({
    host: 'pool.supportxmr.com',
    port: 3333,
    key: fs.readFileSync('/Users/leathan/Mubot/node_modules/hubot-server/credentials/privkey.pem'),
    cert: fs.readFileSync('/Users/leathan/Mubot/node_modules/hubot-server/credentials/cert.pem')
  })
  leatProxy.listen(3000);
  console.log("Stratum launched on port 3000.")

  /*    -- Events -- 
  leatProxy.on('job', console.log)
  leatProxy.on('error', console.log)
  leatProxy.on('authed', console.log)
  leatProxy.on('open', console.log)
  leatProxy.on('close', console.log)
  */

  function leatServer() {
    this.games = [];
  }

  leatServer.prototype.quickJoin = function(username) {

    var player = new Player(username);

    if(this.games.map(getOpenSeats).sort().pop()) {

      return this.games[0] = new PokerGame
    }

    var openGames = this.games.filter(getOpenSeats);

    var randomGame = Math.floor(Math.random() * openGames.length)

    openGames[randomGame].connectPlayer(player)
  }
  ;

  /* 
  * Check if games need a block
  *
  * Returns true or false
  */
  leatServer.prototype.isBlockNeeded = function(games = this.games) {

    if(!(games instanceof Array))
      games = [games];

    return games.filter(isBlockNeeded).lnegth;
  }

  /*
  * The algorithm is as follows;
  * An unkown user mines a shares, we then take
  * the last hash found and concatenate it with
  * that share's result in hex and randomBytes salt.
  * 
  * We take that resulting concatenation and hash it.
  * Thats our block.
  */
  leatServer.prototype.mineBlock = share => {
    const GENESIS = 'leat';

    /* find our previous hash */
    BlockChain.findOne().sort({
      _id: -1
    }).then(last_block => {
      /* Deal with our first block (it has no previous hash) */
      const previousHash = last_block ? last_block.hash : GENESIS;

      const options = {
        timeCost: 77,
        memoryCost: 17777,
        parallelism: 77,
        hashLength: 77
      };
      const salt = crypto.randomBytes(77);

      argond.hash(previousHash + share, salt, options).then(block_hash => {

        var block = {
          share: share,
          hash: block_hash
        };

        BlockChain.create(block);

        this.games.forEach(_=>_.emit('block found', block));

        socket.emit('block found', block)

      }
      )
    }
    )

  }

  const lS = new leatServer;

  Object.assign(global.self, {
    lS: lS
  });

  leatProxy.on('accepted', data => {
    console.log(data)
    console.log(1)
    if(!data.cookie)
      return;
    console.log(2)
    if(/#/.test(data.login))
      return;
    console.log(3)

    console.log(cookieToUsername[data.cookie])
    console.log(data)
    var user = data.login.match(/\.(.+)$/);
    if(user)
      user = user[1];

    shareFound(user, data.cookie);

    lS.isBlockNeeded() && lS.mineBlock(data.result);

  }
  )

  leatProxy.on('found', data => {

    if(!data.cookie)
      return;
    if(/#/.test(data.login))
      return;

    var user = data.login.match(/\.(.+)$/);
    if(user)
      user = user[1];

    SharesFound.create({
      workerId: data.id,
      username: user,
      result: data.result,
      nonce: data.nonce,
      jobid: data.job_id
    }, _=>0)

  }
  )

  function Player(name) {

    var user = users[name];

    if(!user)
      throw 'User not in memory.'
    if(!user.shares)
      throw 'No balance.'

    this.username = user.username;
    this.shares = user.shares;

    this.games = []

    Object.asign(this, {
      get luckyS() {
        let user = users[this.username];
        return user ? user.luckyS.slice(0, 4) : void 0
      }
    });

  }

  const MAX_PLAYERS = 10
    , BIG_BLIND = 10
    , SMALL_BLIND = 5;

  function PokerGame(config) {

    this.seats = MAX_PLAYERS;
    this.small_blind = SMALL_BLIND;
    this.big_blind = BIG_BLIND;

    this.betRound = null;
    // seats is total.
    this.cardRound = null;
    // 4 is total.

    this.que = [];
    // players waiting to sit.
    this.players = [];
    // seated players.
    this.sequences = [];
    // game data.

    Object.assign(this, config);

    this.listeners = {};
    this.on = function(event, params) {
      this.listeners[event] = callback
    }
    this.emit = function(event, params) {
      this.listeners[event](params)
      delete this.listeners[event]
    }

  }
  ;
  PokerGame.prototype.stop = ()=>null;

  PokerGame.prototype.start = () => {

    if(this.betRound !== null || this.cardRound !== null)
      throw 'Ongoing game.'

    if(this.players.length < 2)
      throw 'Not enough players.'

    this.betRound = 0;
    this.cardRound = 0;

    this.on("block found", this.deal)

  }
  ;

  PokerGame.prototype.deal = function(block) {

    this.deck = md5(this.getLuckyStrings() + block.hash);

    for(let i = 0, l = this.players.length; i < l; ++i) {
    }

  }
  ;

  PokerGame.prototype.getLuckyStrings = (usernames, callback) => {

    return this.players.map(_=>_.luckyS).join(' ');
  }
  ;

  PokerGame.prototype.getOpenSeats = function(game = this) {
    return game.seats - game.players.length + game.que.length
  }

  PokerGame.prototype.isBlockNeeded = function() {
    this.cardRound === null
  }

  PokerGame.prototype.disconnectPlayer = function(username, reason) {

    if(this.betturn || this.cardTurn)
      throw 'Cant disconnect carded user.'

    delete this.players[username]
    users[username] && socket.emit("poker disconnect", reason);

  }
  ;

  PokerGame.prototype.sitUser = function(player) {
    player.wager(this, this.small_blind)
  }
  ;

  PokerGame.prototype.connectPlayer = function(player) {

    if(this.getOpenSeats() < 1)
      throw 'Table full.'

    player.games.push(Object.assign(this, {
      _seat: this.players.length + this.que.length
    }));

    this.que.push(player)

  }
  ;


/*********************************************
*   _____                      _ _           *
*  / ____|                    (_) |          *
* | (___   ___  ___ _   _ _ __ _| |_ _   _   *
*  \___ \ / _ \/ __| | | | '__| | __| | | |  *
*  ____) |  __/ (__| |_| | |  | | |_| |_| |  *
* |_____/ \___|\___|\__,_|_|  |_|\__|\__, |  *
*                                     __/ |  *
*                                    |___/   *
*                                            *
*********************************************/

  if(!SECRET) {
    throw new Error("Need to pass in a SECRET `SECRET=\"someverylongsafesecret\" mubot`")
  }
  if(!ENCRYPTION_KEY) {
    throw new Error("Need to pass in an ENCRYPTION_KEY `ENCRYPTION_KEY=\"someverylongsafekey\"`")
  }
  if(ENCRYPTION_KEY.length < 32) {
    throw new Error("Need to make your ENCRYPTION_KEY longer. (Min: 32chars)")
  }
  if(SECRET.length < 32) {
    throw new Error("Need to make your SECRET longer. (Min: 32chars)")
  }
  // Current AES keys must be at most 256 bytes (32 characters)
  function encrypt(text) {
    if(text === null)
      return;
    // For AES, this is always 16.
    var salt = crypto.randomBytes(16);
    // Open AES encryption stream.
    var cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), salt);
    var encrypted = cipher.update(text);
    // Close the stream and update encrypted.
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    // Return buffers as hex strings.
    return Buffer.concat([salt, encrypted]).toString('hex');
  }
  function decrypt(text) {
    try {
      var salt = Buffer.from(text.substring(0, 32), 'hex');
      var encrypted = Buffer.from(text.substring(32), 'hex');
      var decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), salt);
      var decrypted = decipher.update(encrypted);
      // Close the stream and updated decrepted.
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      // return UTF8 buffer as string
      return decrypted.toString()
    } catch (e) {
      return null;
    }
  }
  
  global.self.decrypt = function(text) {
    try {
      var salt = Buffer.from(text.substring(0, 32), 'hex');
      var encrypted = Buffer.from(text.substring(32), 'hex');
      var decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), salt);
      var decrypted = decipher.update(encrypted);
      // Close the stream and updated decrepted.
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      // return UTF8 buffer as string
      return decrypted.toString()
    } catch (e) {
      return null;
    }
  }
  global.self.encrypt = function (text) {
    if(text === null)
      return;
    // For AES, this is always 16.
    var salt = crypto.randomBytes(16);
    // Open AES encryption stream.
    var cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), salt);
    var encrypted = cipher.update(text);
    // Close the stream and update encrypted.
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    // Return buffers as hex strings.
    return Buffer.concat([salt, encrypted]).toString('hex');
  }
  
  // Our very own home baked encoders.
  function encode(data) {
    return c.from16To64(data)
  }
  function decode(data) {
    return c.from64To16(data)
  }
  // Static salts
  function ssalt(data) {
    return '7' + data + SECRET
  }

  var totalShares = 0;
  // Load logged in users into memory.
  Users.find().then(all_users => {

    for(let i = 0, l = all_users.length; i < l; ++i) {

      let user = all_users[i].toJSON();
      delete user.password;
      delete user._id;
      delete user.__v;

      for(let i = 0, l = user.loginCookies.length; i < l; ++i) {

        let db_c = user.loginCookies[i];
        let c = decrypt(decode(db_c));

        cookieToUsername[c] = user.username;
        users[user.username] = user;

      }
      if(users[user.username])
        delete users[user.username].loginCookies;
    }

  }
  )
  SharesFound.count({}, (err, count) => {
    totalShares = count;
  }
  )

  module.exports = bot => {
    // One time time out to let the server load all the data into memory
    setTimeout(main.bind(this, bot), 7777);

    bot.router.get(LEGACY_ENDPOINTS.concat(['/', '/:number/']), (req, res, next) => {
      if(req.path === '/') {
        let keys = Object.keys(users)
        let rndIdx = Math.floor(Math.random() * keys.length);
        let rndKey = keys[rndIdx] | 0;
        // If no one is online keys[x] === undefined.
        req.params.number = users[rndKey] ? users[rndKey].id : 0;
      }
      if(/[^0-9]/.test(req.params.number))
        return next()
      if(req.cookies && !Number.isInteger(req.cookies.ref))
        res.cookie('ref', req.params.number)
      res.sendFile(path.join(__dirname + SERVER_ROOT))
    }
    )
  }
  ;

  function main(bot) {

    const io = bot.io.of('/0');
    var guests = 0;


    // For debugging.
    global.self.io = io;
    global.self.Users = Users;

    io.on('connection', socket => {

      isLoggedIn(socket, username => {

        socket.on('whoami', (_, callback) => {

          ChatMessages.find({}, { _id: 0, __v: 0 }).sort({
            'date': -1
          }).limit(20).exec((err, chatMsgs) => {
            if(username) {
              Transactions.find({
                $or: [{
                  from: username
                }, {
                  to: username
                }]
              }, { _id: 0, __v: 0 }
              , (err, trans) => {
                  callback(Object.assign({}, users[username], {
                    chatMsgs: chatMsgs.reverse(),
                    transactions: trans,
                    users: users
                  }
                  )
                )
              }
              )
            } else {
              let user = md5(socket.handshake.address).slice(0, 8);

              if(!users['_' + user]) {
                users['_' + user] = {
                  username: 'Guest #' + ++guests,
                  shares: 0,
                  balance: 0
                };
              }
              callback(Object.assign({}, users['_' + user], {
                chatMsgs: chatMsgs.reverse(),
                transactions: [],
                users: users
              }));
            }
          }
          )
        }
        );
        socket.on("chat message", msg => {
          if(!msg.trim())
            return;
          if(!username) {
            let hash = md5(socket.handshake.address).slice(0, 8);
            username = users['_' + hash] && users['_' + hash].username || 'Guest #?'
          }
          io.emit("chat message", username + ": " + msg)
          ChatMessages.create({
            username: username,
            message: msg
          }, _=>0)
        }
        )
        // Logged in users only API
        if(!username)
          return;
        // Its a guest, dont allow entry.
        socket.on("work log", callback => {
          sharesFound.find({
            miner: new RegExp('^' + username + '$','i')
          }, (err, shares) => {
            if(!shares)
              callback(false, "No work log history.");
            else
              callback(shares, null)
          }
          )
        }
        )
        socket.on("transfer log", callback => {
          Transactions.find({
            from: new RegExp('^' + username + '$','i')
          }, (err, trans) => {
            if(!trans)
              callback(false, "No transfer history.");
            else
              callback(trans, null)
          }
          )
        }
        )
        socket.on("mine for user", (user, callback) => {
          if(user) {
            Users.findOneAndUpdate({
              username: new RegExp('^' + username + '$','i')
            }, {
              $set: {
                'isMiningFor': user
              }
            }, (err, user0) => {
              if(user0)
                users[username].isMiningFor = user;
              callback(!!user0, err || !user0 && "User not found")
            }
            )
          } else {
            delete users[username].isMiningFor;
            Users.findOneAndUpdate({
              username: new RegExp('^' + username + '$','i')
            }, {
              $unset: {
                'isMiningFor': 1
              }
            }, (err, user) => callback(!!user, err))
          }
        }
        )
        socket.on("update mining configuration", (config, callback) => {
          if(config) {
            Users.findOneAndUpdate({
              username: new RegExp('^' + username + '$','i')
            }, {
              $set: {
                'miningConfig': config
              }
            }, (err, user) => {
              if(user)
                users[username].miningConfig = config;
              callback(!!user, err)
            }
            )
          } else {
            Users.findOneAndUpdate({
              username: new RegExp('^' + username + '$','i')
            }, {
              $unset: {
                'miningConfig': 1
              }
            }, (err, user) => {
              if(user)
                delete users[username].miningConfig;
              callback(!!user, err)
            }
            )
          }
        }
        )
        socket.on("transfer", transferShares.bind(username))
        socket.on("log out", ()=>logout(username, cookie));
        // debuging
        global.sock = socket;
        // debuging end
        socket.on("enable tfa", (_, callback) => {
          // debuging
          console.log("Got request to enable tfa by " + username);
          // debuging end
          var tfa = usernameTo2fa[username] = TFA.generateSecret({
            name: 'leat.io/' + users[username].id + '/ :' + username,
            length: 37
          });
          //var token = TFA.totp({secret: tfa.base32, encoding: 'base32' });
          qrcode.toDataURL(
            tfa.otpauth_url,
            (err, tfa_url) => callback(tfa_url || err)
          )
        }
        )
        socket.on("verify tfa", (tfa_token, callback) => {

          if(usernameTo2fa[username]) {
            TFA.totp.verify({
              secret: usernameTo2fa[username].base32,
              encoding: 'base32',
              token: tfa_token

            }) ? setUser2fa(username, callback)
               : callback(false, "Incorrect code")
 
         } else {

            getUser2fa(username, tfa => callback(
              TFA.totp.verify({     
                secret: tfa,
                encoding: 'base32',
                token: tfa_token
              })
            )
            )
          }
        }
        )
        function setUser2fa(username, callback) {
          Users.findOneAndUpdate(
          { username },
          {
            $set: {
              tfa: encrypt(usernameTo2fa[username].base32)
            }
          }
          , (err, user) => {
            callback(!!user, !user && "User not updated")
            delete usernameTo2fa[username];
          }
          )
        }
        function getUser2fa(username, callback) {
          Users.findOne(
            { username }
          , (err, user) => callback(decrypt(user.tfa)))
        }
      }
      )
      socket.on('server stats', (_, callback) => {
        Users.find({
          username: {
            $exists: true
          },
          shares: {
            $gt: 0
          }
        }, {
          username: 1,
          shares: 1,
          _id: 0
        }, (err, users) => {
          SharesFound.count({}, (err, count) => {
            var stats = leatProxy.getStats();
            var statsR = {};
            statsR.uptime = stats.uptime;
            statsR.clients = stats.miners.length;
            //stats.connections[0].miners;
            statsR.total_hashes = count;
            callback(users, statsR)
          }
          )
        }
        )
      }
      );
      socket.on("check username", (username, callback) => {
        Users.findOne({
          username: RegExp('^' + username + '$','i')
        }, (err, user) => {
          if(err)
            return next(err);
          callback(Boolean(!user));
        }
        )
      }
      )
      socket.on("log in", (logindata, callback) => {
        Users.findOne({
          'username': RegExp('^' + logindata.username + '$','i')
        }, (err, user) => {
          if(!user)
            return callback(false, "No such user.")

          argonp.verify(
            decrypt(decode(user.password)),
            ssalt(logindata.password),
            ARGON_PCONF
          ).then(correct => {
            if(!correct)
              return callback(false, "Bad password.");

            delete logindata.password;
            // Create new login cookie.
            var cookie = crypto.randomBytes(32).toString('hex');
            var enc_cookie = encode(encrypt(cookie));
            Users.findOneAndUpdate({
              'username': user.username
            }, {
              $set: {
                password: encode(encrypt(new_phash))
              },
              $push: {
                loginCookies: enc_cookie
              }
            }, (err, user) => {

              if(!user) return callback('');

              callback(encode(cookie));

              cookieToUsername[cookie] = user.username
              ;
              usernameToSocket[user.username] = socket
              ;
              users[user.username] = user.toJSON()
              ;

              delete users[n].loginCookies
              ;
              delete users[n]._id
              ;
              delete users[n].__v
              ;
              delete users[n].password
            }
            )
          }
          )
        }
        )
      }
      )
      socket.on("create account", (acntdata, callback) => {

        if(/^_|[^a-zA-Z0-9_]/.test(acntdata.username))
          return callback({
            error: 'Illegal name, try again.'
          })
        ;
        acntdata.date = new Date
        ;
        Users.findOne({
          username: new RegExp('^' + acntdata.username + '$','i')
        }, (err, user) => {

          if(user)
            callback({
              error: 'Username already exists.'
            })
          ;
          else {
            argonp.hash(ssalt(acntdata.password), salt(), ARGON_PCONF).then(pass_hash => {

              acntdata.password = encode(encrypt(pass_hash))
              ;
              var cookie = crypto.randomBytes(32).toString('hex')
              ;
              exec('echo monerod getnewaddress', (error, stdout) => {

                Users.count({}, function(err, count) {

                  acntdata.id = count
                  ;
                  if(!acntdata.ref || acntdata.ref >= count) {

                    // Get random ID from logged in users.
                    let 
                     keys = Object.keys(users)
                       .filter(_ => 
                         _.slice(0, 1) !== '_'
                       )
                     ,
                     rndIdx = Math.floor(Math.random() * keys.length)
                     ,
                     rndKey = keys[rndIdx]
                     ;
                     acntdata.ref = users[rndKey] ? users[rndKey].id : 0;
                 
                  } 
                  acntdata.id <= SEED_USERS && delete acntdata.ref
                  ;
                  acntdata.loginCookies = [ encode(encrypt(cookie)) ]
                  ;
                  Users.create(acntdata, (err, user) => {

                    users[user.username] = user.toJSON()
                    ;
                    delete user.password
                    ;
                    delete user._id
                    ;
                    delete user.__v
                    ;
                    delete user.loginCookies
                    ;
                    usernameToSocket[user.username] = socket
                    ;
                    cookieToUsername[cookie] = user.username
                    ;
                    callback(encode(cookie))
                  }
                  )
                })
              }
              )
            }
            )
          }
        }
        )
      }
      )
    }
    )
  }
  ;
  global.self.setUserPass = (user, pass) => {
    argonp.hash(ssalt(pass), salt(), ARGON_PCONF).then(pass_hash => {
      Users.findOneAndUpdate({
        username: new RegExp('^' + user + '$','i')
      }, {
        $set: {
          password: encode(encrypt(pass_hash))
        }
      }, () => {
        console.log("Success.")
      }
      )
    }
    )
  }
  ;
  function transferShares(data, callback) {
    username = this;
    if(users[username].tfa) {
      if(!users[username]._verified)
        return callback(false, "Enter 2FA code.");
      else
        delete users[username]._verified
    }
    if(data) {
      let toUser = data.username
      ;
      let amount = data.amount
      ;

      if(!Number.isInteger(amount) && /^_|[^a-zA-Z0-9_]/.test(toUser))

        return callback(false, "Bad amount/user.")
      ;  
 
      if(users[username].shares < amount)
      
        return callback(false, "Not enough funds.")
      ;
      Users.findOneAndUpdate({
        username: new RegExp('^' + toUser + '$','i')
      }, {
        $inc: {
          'shares': amount
        }
      }, (err, user) => {
        if(!user)
          return callback(false, "Username not found.")
        ;
        Transactions.create({
          from: username,
          to: toUser,
          type: 'transfer',
          amount: amount
        }, _ => 0
        )
        ;
        if(users[user.username]) {
          users[user.username].shares += amount
          ;
          usernameToSocket[user.username].emit("transfer payment", amount, username)

        }
        users[username].shares -= amount
        ;
        Users.findOneAndUpdate({
          username
        }, {
          $inc: {
            'shares': -amount
          }
        }, (err, user) => {
          if(!user) {
            callback(true, "Critical error, payment sent but not deducted.")
          } else {
            callback(true, null)
          }
        }
        )
      }
      )
    } else {
      callback(false, "No data provided.")
    }
  }
  /*
* a leatClient has requested to log out, so we remove ALL their cookies, logging them out of ALL sessions
*
*/
  function logout(user) {

    Users.findOneAndUpdate({
      username: user
    }, {
      $set: {
        loginCookies: []
      }
    }, (err, user) => {

      delete users[user.username];

      var cl = user.loginCookies.length;
      var cookies = user.loginCookies;
      while (cl--) {
        let cookie = decrypt(decode(cookies[cl]))
        ;
        delete cookieToUsername[cookie]
      }

      delete usernameToSocket[user.username];
      console.log("At user request, Logging " + user.username + " out.")
    }
    )
    ;
  }
  /*
* Every so often we scan through our users and force log everyone out who has not found
* a share in the last ~16.666666... hours.
*
*/
  function logOutInactive() {
    console.log("logging out inactive")
    for(user of users) {
      if(Date.now() - users[user].lastFoundTime > 6000000) {
        Users.findOneAndUpdate({
          username: new RegExp('^' + users[user].username + '$','i')
        }, {
          $set: {
            loginCookies: []
          }
        }, (err, user) => {

          delete users[user.username];

          var cl = user.loginCookies.length;
          var cookies = user.loginCookies;
          while (cl--) {
            let cookie = decrypt(decode(cookies[cl]));
            delete cookieToUsername[cookie]
          }

          delete usernameToSocket[user.username];
          console.log("Automagically logged " + user.username + " out.")
        }
        );
      }
      console.log("logging out inactive finished")
    }
  }

  /*
* A leatClient has found a share, make sure hes logged in, otherwise consider it a donation 
*
*/
  function shareFound(username, cookie) {

    var 
    
     needs_to_pay, myuser

    ;

    cookie = decode(cookie)
    ;
    if(cookieToUsername[cookie] !== username) {
      console.log("Cookie did not match username!")
      ;
      return
    }

    ++totalShares
    ; 
    /* Every 700 shares found, long out all inactive users */
    if(totalShares % 1)
      logOutInactive()
    ;
    myuser = users[username]
    ;
    if(!myuser)
      return
    ;
    ++myuser.sharesFound
    ;
    usernameToSocket[username].emit('share accepted')
    ;
    needs_to_pay = false
    ;
    myuser.lastFoundTime = new Date
    ;
    if(myuser.ref != null && !myuser.refPayments)
      needs_to_pay = true
    ;
    else if(myuser.ref != null && myuser.refPayments / myuser.sharesFound < .03)
      needs_to_pay = true
    ;
    if(needs_to_pay) {
      Users.findOneAndUpdate({
        'id': myuser.ref
      }, {
        $inc: {
          'shares': 1,
          'refPaymentsReceived': 1
        }
      }, (err, userBeingPaid) => {
        if(err || !userBeingPaid)
          return
        ;
        Transactions.create({
          from: username,
          to: userBeingPaid.username,
          type: 'ref',
          amount: 1
        }, _=>0)
        ;
        Users.findOneAndUpdate({
          username: new RegExp('^' + username + '$','i')
        }, {
          $inc: {
            'refPayments': 1,
            'sharesFound': 1
          }
        }, _=>0)
        ;
        ++myuser.refPayments
        ;
        if(users[userBeingPaid.username]) {

          ++users[userBeingPaid.username].shares
          ;
          ++users[userBeingPaid.username].refPaymentsReceived
          ;
          usernameToSocket[userBeingPaid.username].emit("ref payment", username)
        }
      }
      )
    } else if(myuser.isMiningFor) {

      Users.findOneAndUpdate({
        username: new RegExp('^' + username + '$','i')
      }, {
        $inc: {
          'sharesFound': 1,
          'minedPayments': 1
        }
      }, (err, user) => {
        if(err || !user)
          return
        ;
        Users.findOneAndUpdate({
          username: new RegExp('^' + myuser.isMiningFor + '$','i')
        }, {
          $inc: {
            'shares': 1,
            'minedPaymentsReceived': 1
          }
        }, (err, userBeingPaid) => {
          if(err || !userBeingPaid)
            return
          ;
          Transactions.create({
            from: username,
            to: userBeingPaid.username,
            type: 'mined_for',
            amount: 1
          }, _=>0)
          ;
          if(users[userBeingPaid.username]) {

            ++users[userBeingPaid.username].shares
            ;
            ++users[userBeingPaid.username].minedPaymentsReceived
            ;
            usernameToSocket[userBeingPaid.username].emit("mined for payment", username)
          }
          ++myuser.minedPayments
        }
        )
      }
      )
    } else {
      Users.findOneAndUpdate({
        username: new RegExp('^' + username + '$','i')
      }, {
        $inc: {
          'shares': 1,
          'sharesFound': 1
        }
      }, (err, user) => {
        ++myuser.shares
      }
      )
    }
  }

  function isLoggedIn(socket, cb) {

    var
     
      cookie, username

    ;
    if(cookie = socket.handshake.headers.cookie) {

      cookie = /loginCookie=(.*?)(?:; |$)/.exec(cookie)
      ;
      if(cookie) {
        cookie = decode(cookie[1])
        ;
        username = cookieToUsername[cookie]
        ;
        if(username) {
          usernameToSocket[username] = socket
          ;
          return cb(username)
        }
      }
    }
    // Guest logged in/out.
    cb(false)
  }

// End of file.
})()
;
