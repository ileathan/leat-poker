# leat-poker

My goals are purely altruistic, as you can see from the code all monetization is shared as if I were an end user.


# Its provably fair!

**How it works**

1.) We have the stratum delegate jobs that dont need to report back too soon. (high diff)

2.) Whenever / whichever / whoever completes a job first we ues it.

3.) If there is even a single game going on the stratum queries the core server which mines a modest block.

4.) Now that we have our block we use it to generate the pre-deck-hash for all tables. When the server hands the clients the block if they do not _immediately_ respond with a lucky string they are disconnected. (They use this to generate their cards) If all users respond with lucky strings then the server allows betting, and continues to verify that the user is hashing fairly on all subsequent bets untill the game is over.

5.) Once the game is over the salting data used to generate the block, along with any unused data cards are disclosed to the clients so that they may verify the hash against the work submitted, and the past blocks/decks.


# Whats in this repo

The list of code I am both generating, refactoring, and pulling is growing larger and larger so I will keep track of it here.

1.) In the NodeJS server (`server/leat.js`) we create our stratum and start listening like so.

```
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

  /* -- Events -- (leatProxy._eventListeners) 
  leatProxy.on('accepted', console.log)
  leatProxy.on('found', console.log)
  leatProxy.on('job', console.log)
  leatProxy.on('error', console.log)
  leatProxy.on('authed', console.log)
  leatProxy.on('open', console.log)
  leatProxy.on('close', console.log)
  */

```


2.) In the client's brower `client/leat.js` we run this command
```
lC.miner = new leatMine.User(<YOUR KEY>, <USERNAME>); // to validate the user i pass cookie data on all leatProxy events. 
lC.miner.start();
```
3.) The Stratum file is `leat-proxy-stratum.js` 

4.) The mining library. `leat-mine.js`

ill seperate this out into a config file today, but for now -> ***Open the file and go to the end and make these all match up***

```
self.leatMine.CONFIG = {
  LIB_URL: 'https://leat.io/lib/',
  ASMJS_NAME: 'leathash-asmjs.min.js',
  REQUIRES_AUTH: false,
  WEBSOCKET_SHARDS: [['wss://leat.io:3000']],
  CAPTCHA_URL: '',
  MINER_URL: '',
  AUTH_URL: ''
};
leatMine.CRYPTONIGHT_WORKER_BLOB = URL.createObjectURL(new Blob([" self.leatMine=self.leatMine||{};self.leatMine.CONFIG={LIB_URL:\"https:\/\/leat.io\/lib\/\",ASMJS_NAME:\"leathash-asmjs.min.js\",REQUIRES_AUTH:false,WEBSOCKET_SHARDS:[[\"https:\/\/leat.io:3000\"]],CAPTCHA_URL:\"\",MINER_URL:\"\",AUTH_URL:\"\"};
```
_for example i edited LIB_URL (it can point anywhere, just move leathash* files there) and i also edited the WEBSOCKET_SHARDS (put your domain and the port your stratum is listening too here)_


**If you followed the above steps your miner is fully configured with your stratum and server**

4.) The poker libraries are not ready yet.

5.) The encoder (and its bignumber.js dependancy) which will be removed later since we dont need it.

4.) The block chain libraries are not ready yet.


# Show me some code

You are welcome to click the links in this repo and read and contribute, there is lots and lots I have yet to do. but the Server/Client paradigm may be a little like so:


**SERVER**
```
  /*
  * The algorithm is as follows;
  * An unkown user mines a shares, we then take
  * that share hash it against the last decks of cards 
  * and thats it.              
  *
  * The blocks hence contain the following info:
  * Relative dates
  * Ledger of who won/lost
  * Provable deck generation 
  * Verification of all previous decks 
  */
  leatServer.prototype.mineBlock = share => {
    const GENESIS = 'leat'
    ;
    /* find our previous hash */
    BlockChain.findOne().sort({
      _id: -1
    }).then(last_block => {
      /* Deal with our first block (it has no previous hash) */
      const previousHash = last_block ? last_block.hash : GENESIS
      ;
      const options = {
        timeCost: 77,
        memoryCost: 77777,
        parallelism: 77,
        hashLength: 77
      }
      ;
      const salt = crypto.randomBytes(77)
      ;
      argond.hash(previousHash + share + secrets, salt, options).then(block_hash => {
        var block = {
          block_hash,
          verifies: {
            secrets, // I believe this will be broadcasted next block since the clients already know their secrets and since the block is already generated there may be no way to fit this data untill next block (So genesis will be void 0, res is last_games_secrets).          
            share,
            previousHash
          }
        }
        ;
        BlockChain.create(block)
        ;
        this.games.forEach(_=>_.emit('block found', block))
        ;
        socket.emit('block found', block)
        ;
      })
      ;
    })
    ;
  }
```
**CLIENT**
```
   // Deck is an immutable constantly carried over from last game
   // on all tables.
   function shuffle(Deck, block, secrets) {
      /* 
      * Our encoder.
      */
      const c = require('encode-x')();
      /*
      * Everything is an immutable constant.
      *
      ******************************************************
      *                                                    *
      *         The magic happens here, an ordinary        *
      *         HMAC-SHA512 hash created LOCALLY and       *
      *         seeded by the END USER creates the         *
      *         deck and is inserted into the next block   *
      *                                                    *
      * Note we preserve shreaded deck for future shuffles *
      ******************************************************/
      const Shuffled = sha512.hmac(
        secrets, Deck
        // This hashed is our next block.
      ).finalize()
      ;
      // Preserve shreads.
      Deck.shreads = 
        Shuffled.toString('hex')
      ;
      // Reduce till we have a deck (no repeats).
      const Debloated = Object.keys(
        c.from16to52(Deck.shreads)
         .split('').reduce(
           (a,_) =>
             a[_] = _ && a
         )
      )
      ;
      // Push to deck, most significant bits first.
      Deck.forEach(()=>
        Deck.shift()
        && Deck.push(
          base52ToCard(
            Debloated[Deck.length]
          )
        )
      )
      ;    
  }
```


At the end of the day merging the server/clients into one and leaving http(s) all together is a must, but bootstrapping ourselves in the web with open code is the way to go.
