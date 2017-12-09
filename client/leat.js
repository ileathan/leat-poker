/*  * * * * * * * * * * * * * * * * * * * * * * *
*      _            _   __  __ _                *
*     | |          | | |  \/  (_)               *
*     | | ___  __ _| |_| \  / |_ _ __   ___     *
*     | |/ _ \/ _` | __| |\/| | | '_ \ / _ \    *
*     | |  __/ (_| | |_| |  | | | | | |  __/    *
*     |_|\___|\__,_|\__|_|  |_|_|_| |_|\___|    *
*                                               * 
*                                               *
* * * * * * * * * * * * * * * * * * * * * * * * *
*
*
*
*
*
* 
*
* Create our lC (leatClient) */
const lC = { socket: io('/0', { timeOut: 77777 }) };
/* Turn it into a event emitter */
lC.emit = function(event, params) {
  this._listeners[event](params);
};
/* Handle events */
lC.on = function(event, callback) {
  this._listeners[event] = callback
};
/* Our only event thus far (the games will be most of them)*/
lC._listeners = {
  loaded: []
};

/*
*  Ask the server who we are.
*
*  Since the leatClient has no idea who he is, emit on the socket a request to populated
*  our leatClient object with all the goodies we need.
*
*/
lC.socket.emit("whoami", null, res => {

  Object.assign(lC, res);

  /complete|interactive/.test(document.readyState) ? setTimeout(lC.load, 0) : lC._needLoad = true

});

/* old, but keep
*
lC.socket.on("whoareyou", () => {

  lC.socket.emit("authenticating");

})*/

/*
* Make sure we load.
*
* On the off chance the server is ready when the DOM isnt (should be never).
*
*/
$(() => lC._needLoad && delete lC._needLoad && lC.load());

/* 
* Generate the leatClient. (locally)
*
* Stupid ass localStorage cant hold anything other than
* primitives.. so we add this clearly needed hack
* which I reckon will get lengthier should I decide
* to cache the functions themselves
*
*/
lC.toStorage = obj => {
  try {
    storage = JSON.parse(localStorage.leatMine)
  } catch(e) {
    storage = JSON.parse(localStorage.leatMine = "{}")
  }
  Object.assign(storage, obj);

  localStorage.leatMine = JSON.stringify(storage);

  return obj
}
/* And to retrieve */
lC.fromStorage = feild => {
  return JSON.parse(localStorage.leatMine)[feild]
}

/*
* Mark the leatClient (locally)
*
* This is done so that the server can send only the data that is chronologically needed.
*
*/
lC._mark = lC.toStorage({mark: Date.now()});

/*
* Load mining configuations.
*
* A copy of this is still held by the server, but that will probably depreciate.
*
*/
lC.miningConfig = lC.fromStorage('miningConfig') || lC.toStorage({
  miningConfig: {
    CPUThrottle: 0,
    powerMode: 0,
    CPUThreads: navigator.hardwareConcurrency|0
  }
});



lC.chatBoxIsScrolled = lC.fromStorage('chatBoxIsScrolled') || lC.toStorage({chatBoxIsScrolled: {}})

/*
* Load the last chatbox type.
*
*/
/* Sanity check, incase user changed the default params. */
['chat', 'work', 'trans'].includes(lC.fromStorage('_chatBox')) || lC.toStorage({_chatBox: 'chat'});
lC._chatBox = lC.fromStorage('_chatBox');

/* 
* Start Miner and 5 seconds later start plotting to CPU chart
*/
lC.miner = new leatMine.User();
lC.miner.start();

/*
* Extract and save ref info.
*
* As you can see this is very easily game-able to 0 and hence why I will advertise no fees.
*
*/
let pRef;
pRef = window.location.pathname.match(/\/(\d+)(?:\/|$)/);
pRef = document.cookie.match(/ref=(\d+)(?:;|$|\/)/);
pRef = pRef ? pRef[1]|0 : 0;


window.location.pathname;

/leathan/i.test(window.location.href) && (window.location.href = "https://leat.io" + window.location.pathname);


window.history.pushState({}, "", "/");


localStorage.ref ? pRef = localStorage.ref : localStorage.ref = pRef;

/* Used for generating our user colors */
lC.userpalette = new Rickshaw.Color.Palette({scheme: 'cool'});

/*
* Get server user/share info
*
* This updates .user-stats / #pieChart svg
*
*/
lC.refreshStats = () => {
  graphics.pie.destroy && graphics.pie.destroy();
  lC.socket.emit("server stats", {}, (users, stats) => {

    graphics.pieContent = [];

    /* loop through all users and save color plys add them to the piegraph. */
    for(let u of users) {
      graphics.pieContent.push({
        label: u.username,
        value: u.shares,
        color: lC.userpalette.color()
      })
    }
    loadPieChart(); // from io0.js.
    $('#total-shares').text(stats.total_hashes|0);
    $('#total-miners').text(+stats.clients + 1);
    $('#total-uptime').text(Math.round(stats.uptime / 1000 / 60 / 60 / 24))
  })
};

/*
* Append (transactions) to the chatbox
*
* I need to clean this up, so that I can move worklog, and chatmsgs here. Not to mention hard to read.
*
*/
lC.appendTran = d => {

  var date = new Date().toLocaleString() // + ' ' + new Date().toLocaleTimeString()
  , colotT = d.amount < 0 ? "red" : (d.amount = 1) && "green" 
  , colorU = lC.users[d.user] && lC.users[d.user].color || (lC.users[d.user].color = lC.userpalette.color())
  , flag = ["REF PAYMENT", "ref-payment", "MINED FOR", "minedfor-payment", "TRANSFER", "transfer"][d.type]
  , html = '<li>' + date + ' <span style="color:"' + colorT  + '"><b>'+ d.amount + (d.received ? " received from " : " sent to ")
  + '</b></span><font style="color:' + colorU + '">' + d.user + '</font><span class="payment "' + flag[d.type+1] + '>'+ flag[d.type] + '</span></li>';
  $('#transactions').append(html);   


  if(!chatBoxIsScrolled.trans) {
    $('.chatbox').scrollTop($('.chatbox')[0].scrollHeight);
    $('#shares').text(lC.shares += d.amount)
  }
};

/*
* Interact with the appendTran
*
* The commented out code is the old version.
*
*/
lC.socket.on("ref payment", fromUser => lC.appendTran({user: fromUser, type: 0}))
lC.socket.on("mined for payment", fromUser => lC.appendTran({user: fromUser, type: 2}));
lC.socket.on("transfer payment", fromUser => lC.appendTran({user: fromUser, type: 4})); 

/*
* Transfer shares
*
* Once the platform has actual bits, this will also transfer bits. 2FA is optional here.
*
*/
lC.transfer = () => {
  let amount = (a = $('#transfer-amount-input')).val(), toUser = (t = $('#transfer-to-input')).val();
  lC.socket.emit("transfer", {amount: amount, username: toUser}, (res, err) => {
    if(res) {
      $('#transfer-info').text("Sent " + toUser + " " + amount).css('color', 'gold');
      // Record the transfer to the transaction log.
      lC.appendTran({user: toUser, amont: -amount, type: 4});
      a.val(''); t.val('');
      setTimeout(()=> $('#transfer-info').text("Waiting...").css('color', 'white'), 3500)
    } else {
      $('#transfer-info').text(err).css('color', 'red')
    }
  })
}
;
/*
* User is configuring his miner.
*
* The miner starts assuming, intelegent to the future, at high load. I coded this entire thing with it on max,
* and that is the recommended setting, but as per user requests the option is here to throttle, powerMode, or even turn it off.
*/
lC.setMiningConfig = function(type, increase) {

  if(type === 'threads') {
    if(increase) {
      this.CPUThreads < navigator.hardwareConcurrency && lC.miner.setNumThreads(++this.CPUThreads);
      this.CPUThreads === 1 && !lC.miner.start() && $('#power-mode-container').remove()      
    } else {
      if(this.CPUThreads === 0 )return;
      else if(this.CPUThreads > 1) {
        lC.miner.setNumThreads(--this.CPUThreads)
      } else { /* CPUThreads === 1 */
        $('#power-mode-container').remove();
        $('#throttle-container').append(
          '<span id="power-mode-container" style="margin-left:70px"> <span class="link" onclick="stopMinerDialog()">Miner Turned Off <span id="power-mode"></span></span></span>'
        );
        this.CPUThreads = 0;
        lC.miner.stop();
        $('#work-log').append('<li><span>Mining shut down <font style="color:red">Threads is at 0 </font>('+Date().toLocaleString()+')</b></span></li>')

        if(this.CPUThreads > 0) --this.CPUThreads;
      }
    }
    $('#threads').text(this.CPUThreads);
 
  } else if(type === 'throttle') {
  
    increase && this.CPUThrottle >= 1 && this.powerMode && ++this.powerMode;
    increase ?
      this.CPUThrottle < 1 && (this.CPUThrottle += .05) :
      this.CPUThrottle > 0 && (this.CPUThrottle -= .05) ;
    lC.miner.setThrottle(this.CPUThrottle);
    $('#throttle').text(parseInt(Math.round((this.CPUThrottle * 100))) + '%');

    if(this.powerMode) {
      $('#power-mode-container').remove();
      $('#throttle-container').append('<span id="power-mode-container" style="margin-left: 50px"> <a href="javascript:;" onclick="event.preventDefault(); lowPowerModeDialog()">Low Power Mode <span id="power-mode"></span></a></span>');
      lowPowerMode()
    } else {
      this.powerMode = 0;
      if(lC.miner.isRunning()) $('#power-mode-container').remove()
    }
  }
  lC.updateMiningConfig();
  return !!(localStorage.miningConfig = this);

}.bind(lC.miningConfig);

/*
 Start
  _____                 _     _             
 / ____|               | |   (_)            
| |  __ _ __ __ _ _ __ | |__  _ _ __   __ _ 
| | |_ | '__/ _` | '_ \| '_ \| | '_ \ / _` |
| |__| | | | (_| | |_) | | | | | | | | (_| |
 \_____|_|  \__,_| .__/|_| |_|_|_| |_|\__, |
                | |                   __/ /
 Section        |_|                  |___/ 
*
*
*
* Create the CPU graph.
*/ 
lC.graph = { 
  time: 0,
  palette: new Rickshaw.Color.Palette({scheme: 'spectrum2000'}),
};

lC.loadGraph = function() {

  /* Here we store our CPU info in a 2 dimensional
   * array, the first dimension represents the thread number
   * the second is the threads hashing speeds versus time. 
   * x = time, y = hashes per second
   */
  this.seriesData = [];
  /* Loop through the available CPU threads */
  let i = 0, l = lC.miner._targetNumThreads;
  do {
    this.seriesData[i] = [];
    this.seriesData[i].push({x: 0, y: 0}) // First spot is a dud.
  } while(++i < l);

  /* series is a 1 dimensional array of objects, 
   * which represent a CPU thread, the object in turn 
   * references series data which holds the CPU info 
   */
  this.series = [];
  /* This should match the CPU threads we set seriesData with */
  for(let i = 0, l = this.seriesData.length; i < l; ++i) {
    this.series.push({
      name: 'Thread ' + i, 
      color: this.palette.color(),
      data: this.seriesData[i]
    })
  }
  /*  
  * Here we finally create the graph,
  * which we store right in lC.graph.
  * so the final graph is lC.graph.graph
  */
  this.graph = new Rickshaw.Graph({
    element: document.getElementById("chart"),
    width: 400,   
    height: 150,
    stroke: true,
    renderer: 'stack',
    series: this.series
  });
  /*this.hoverDetail = new Rickshaw.Graph.HoverDetail({
    graph: this.graph,
    xFormatter: function(x) {
      return new Date(x * 1000).toString();
    }
  });*/
  /*this.legend = new Rickshaw.Graph.Legend({
    graph: this.graph,
    element: document.getElementById('legend')
  });*/
  this.annotator = new Rickshaw.Graph.Annotate({
    graph: this.graph,
    element: document.getElementById('timeline')
  });
  
  this.graph.render();

  lC.refreshGraph();

  /* lil hack to ensure timeline is under the svg element
   * without editing the rickshaw source directly */
  var el = $('#timeline').remove();
  $('#chart').append(el);

}.bind(lC.graph);

/*
* Add live data to our CPU graph.
*/
lC.refreshGraph = function(wait) {

  lC.socket.disconnected && lC.socket.connect();

  if(this.seriesData && this.seriesData[0].length > 250)
    lC.resetGraph();

  this.time += 5;
  wait = wait || 5000;

  for(let i = 0, l = this.seriesData.length; i < l; ++i) {
    this.seriesData[i] = this.seriesData[i] || [];
    this.seriesData[i].push({
      x: this.time,
      y: lC.miner._threads[i] ? lC.miner._threads[i].hashesPerSecond : 0
    })
  }
  this.graph.update();
 
  /* Freindly green text for user */
  $('#hps').text(lC.miner.getHashesPerSecond().toFixed(2));
  $('#hashes').text(lC.miner.getTotalHashes());

  setTimeout(lC.refreshGraph.bind(null, wait), wait) 
}.bind(lC.graph);

/*
* Reset the CPU Graph.
*
* I could not find anything in the documentation on how to 
* accomplish this task, so it may seem like a bit of a hack
* to the author, but I have already posted to their github report
* this solution, and it seems people are using it.
*/
lC.resetGraph = function() {
 
  /* Remove the 'Threads' from legend, user should know by now. */
  $('#legend').css('right', '335px');

  /* preserve this 'needed' function */
  var p = this.graph.series.active;


  /* preserve the colors and
  * set the first item of the new data to the
  * last item of the old data.
  */
  var colors = [];
  var _seriesData = [];
  for(let i = 0, l = this.seriesData.length; i < l; ++i) {
    colors.push(this.series[i].color)
    _seriesData[i] = [this.seriesData[i][this.seriesData[i].length-1]]
  }
  this.seriesData = _seriesData;

  /* reset the data to an empty array. */
  this.series = [];

  /* populate series with new data, name field is not needed but i left it */
  for(let i = 0, l = this.seriesData.length; i < l; i++) {
    this.series.push(
      { name: i, 
        color: colors[i], 
        data: this.seriesData[i]
      }
    )
  }
  /* unpreserve */
  this.series.active = p;
  /* set graph data to new data. */
  this.graph.series = this.series;

  $('.annotation_line,.annotation').remove();

  /*document.getElementById('legend').innerHTML = ""
  this.legend = new Rickshaw.Graph.Legend({
    graph: this.graph,
    element: document.getElementById('legend')
  });*/

  this.graph.update() // update

}.bind(lC.graph);

/*
* Anotate our CPU chart with.
*
* The leatMmine object will report here on events.
*
*/
lC.annotateChart = function(text, color) {

  if(!this || !this.annotator) return;

  this.annotator.add(
    this.seriesData[0][this.seriesData[0].length-1].x,
    new Date().toLocaleTimeString() + " " + text
  );
  this.annotator.update()
  // Flag found share red because user is not logged int
  $('.annotation_line').last().css('border-left', '1px solid ' + color)
  $('.annotation').last().css('background-color', color)
  $('.annotation_line').last().addClass('active'); 

}.bind(lC.graph);

/*
  __  __ _                    _____           
 |  \/  (_)                  / ____|          
 | \  / |_ _ __   ___ _ __  | (___   ___  ___ 
 | |\/| | | '_ \ / _ \ '__|  \___ \ / _ \/ __|
 | |  | | | | | |  __/ |     ____) |  __/ (__ 
 |_|  |_|_|_| |_|\___|_|    |_____/ \___|\___|
                                              
*/

lC.miner.on('found', data => {
  // Add information about the found block to the work log.
  $('#work-log').append('<li><span><font style="color:blue"><b>Job done ('+data.job_id+') </b></font><b>['+data.nonce+']&nbsp;</b></span>'+data.result+'</li>');
  ++lC.sharesFound;
 
  if(!lC.chatBoxIsScrolled.trans) {
    $('.chatbox').scrollTop($('.chatbox')[0].scrollHeight);
  }
  
  // Quick terenary check for ref payment status
  lC.ref && lC.refPayments / lC.sharesFound < .03 ?

    lC.needsToPay = true && ++lC.refPayments
  :
    delete lC.needsToPay;

  if(lC.username.slice(0, 6) === 'Guest ') {
    lC.annotateChart("Share found, but not logged in.", "red");
  } else if(lC.needsToPay) {
    lC.annotateChart("Ref share found.", "orange");
  } else if(lC.isMiningFor) {
    lC.annotateChart(
      lC.isMiningFor.charAt(0).toUpperCase() + lC.isMiningFor.slice(1) + " share found.", 'green'
    );
  } else {
    lC.annotateChart("Share found", "green");
  }

  /* All work is rejected if not logged in, so. */
  if(lC.username.slice(0, 6) === 'Guest ') {
    $('#work-log').append('<li><span><font style="color:red"><b>Work rejected ('+data.job_id+')</b></font></span> Not logged in</li>');
    if(!lC.chatBoxIsScrolled.trans) {
      $('.chatbox').scrollTop($('.chatbox')[0].scrollHeight);
    }
  }
});

/* Have yet to see this fire... */
lC.miner.on('error', console.log);

/* Unlike the above calls to .lCminer, this one is authoritive. (comes from server) */
lC.socket.on('accepted', () => {

  /* this is wrong, to fix it i neeed to move this into the sharesFound call, and then react after a server confirmation. */
  $('#work-log').append('<li><span><font style="color:green"><b>Work accepted ' + lC.miner.getAcceptedHashes() + ' ('+lC.workerId+') </b></font></span></li>');

  if(lC.needsToPay || lC.isMiningFor) {
    lC.appendTran(
      { user: user,
        color: lC.toColor(user)
      }
    )
  }

  if(!lC.chatBoxIsScrolled.work) {
    $('.chatbox').scrollTop($('.chatbox')[0].scrollHeight);
  }

  if(!lC.needsToPay && !lC.isMiningFor) $('#shares').text(++lC.shares)
});


/* toColor is used to temporarily save users colors. */
lC.toColor = u => (lC.users[u] || (lC.users[u] = {username: u})) && lC.users[u].color || (lC.users[u].color = lC.userpalette.color());


/* 
   _____            _             _   
  / ____|          | |           | |  
 | |     ___  _ __ | |_ ___ _ __ | |_ 
 | |    / _ \| '_ \| __/ _ \ '_ \| __|
 | |___| (_) | | | | ||  __/ | | | |_ 
  \_____\___/|_| |_|\__\___|_| |_|\__|

* 
*
* DOM READY EVENT FIRED
*
* Our jquery section. We are free to start flashing the screen with data and games!
*
*/
lC.load = () => {

  /* Even if dom isnt ready, we got the user */
  lC.miner.stop();
  lC.miner._user = lC.username;
  lC.miner.start();
  /* Our hack to ensure that if the server is ready and dom isnt we still load */
  delete lC._needLoad;

  lC._chatbox !== 'chat' && lC.resizeChat('down', 'hack')
 
  /* populates #pieChart svg and .server-stats */
  setInterval(lC.refreshStats, 600000); lC.refreshStats();

  /* Ill remove this try catch, but it helped once..., musta been lag induced */
  try {
    /* After the loading animation is up for 5.777 seconds show graph */
    lC.loadGraph();
  } catch(e) {
    window.location.href = window.location.pathname;
  }

  setTimeout(() => {

    $('#loading,.loading').remove();
    $('.chart').removeClass('myhide')

  }, 5777)

  /* 
   * The first job may be a forced contribution to the server host,
   * the rare occurance may be because the miner launches before the dom is loaded
   * the expected behavior is the stratum still broadcasts it as the users,
   * and hence no contribution. But the user will for sure be unotified, of even the work.
   */
  lC.miner.on('job', job => {
    lC.workerId = job.id;
    $('#work-log').append('<li><span><font style="color:orange"><b>New job ('+job.job_id+') </b></font><b>['+job.target+']&nbsp;</b></span>'+job.blob+'</li>');
     if(!lC.chatBoxIsScrolled.trans) {
       $('.chatbox').scrollTop($('.chatbox')[0].scrollHeight)
     }
  });

  /* Print to the work log that were running */
  if(lC.miner.isRunning()) {
    $('#work-log').append(
      '<li><span><b>Mining as <font style="color:' + lC.toColor(lC.username) + '">'
      + lC.username + ' </font></b> '+ new Date().toLocaleDateString() +'.</span></li>'
    );
  }

  /* Populate the chatroom */
  for(let i = 0, l = lC.chatMsgs.length; i < l; ++i) {
    let m = lC.chatMsgs[i];
    let color = lC.toColor(m.username);
    $('#chat').append('<li><span style="color:' + color + '"><b>' + m.username + ': </b></span>' + m.message + '</li>');
    // See if the message is mentioning the lC
    m.username !== lC.username && RegExp('@' + lC.username, 'i').test(m.message) && 
      $('#chat li').last().css('background-color', $.Color($('#chat li').css('background-color')).blue(255))
  }
  // Populate the transaction log
  for(let t of lC.transactions) {
    let color = t.to === lC.username ? 'green' : 'red'
    let typeColor = t.type === "mined_for" ? '#92991d' : t.type === "ref" ? 'orange' : 'blue';
    let usercolor = t.to === lC.username ? lC.toColor(t.from) : lC.toColor(t.to);

    let type = t.type === "mined_for" ? "MINED FOR" : t.type === "ref" ? "REF PAYMENT" : "TRANSFER";
    let html = '<li>' + new Date(t.date).toLocaleDateString() + ' ' + new Date(t.date).toLocaleTimeString()
    + ' <span style="color:' + color + '"><b>' + t.amount + ' ' + (color==='red'?'sent to ':'received from ') + '</span>'
    + '<font style="color:' + usercolor + '">' + (color==='red'?t.to:t.from) + '</b></font><span style="float:right;background-color:'+typeColor+';padding: 1px 19px 1px 19px">'+type+'</span></li>'
    $('#transactions').append(html);
  }



  /* Populate the transaction log with freindly msg if its empty */
  if(lC.transactions.length === 0) {
    $('#transactions').append('<li><b> No history :(</b></span></li>');
  }

  lC.showChat(lC._chatBox, lC._chatBox === 'chat')
  /* Scroll the chatbox to the end. */
  $('.chatbox').scrollTop($('.chatbox')[0].scrollHeight); 

  if(lC.username.slice(0, 6) !== 'Guest ') {

     /* MOVE THIS ENTIRE THING INTO THE HTML FILE AND HIDE IT WITH A CLASS */

    $('#user-stats-container').html(
        /* Draw our menu bar. */
        '<p class="user-stats"><b id="user">' + lC.username + '</b>'
      +   ' [ <span class="link" onclick="lC.logout()">logout</span>'

      +   (!lC.tfa && ' / <span id="dd-tfa"><span class="link"><font id="tfa-link">2FA </font>'
      +     '<span><font class="tfa-disabled">Disabled</font>'

      +       '<img class="tfa myhide" id="qrcode" width="200" height="200"></img>' 

      +       '<button id="tfa-button" onclick="lC.enable2fa()">Enable</button>' 

      +       '<input id="tfa-input" class="tfa myhide tfa-input" required="true" onkeydown="event.keyCode === 13 && lC.enable2fa()" placeholder="Code" tabindex="1">'
      +       '<small id="tfa-info" class="tfa myhide tfa-info">Waiting...</small>'
      +     '</span>'
      +   '</span></span>')

      +   ' / <span class="link" onclick="">withdraw</span> / '
      +   '<span id="dd-transfer"><span class="link"><font id="transfer-link">transfer </font>'
      +     '<span><font style="color:#2e79b7;font-size:larger">Transfer</font>'
      +       '<input id="transfer-amount-input" type="number" min="1" onkeydown="event.keyCode === 13 && lC.transfer()" placeholder="Amount" tabindex="1">'
      +       '<font class="dd-to-text">To</font>'
      +       '<input id="transfer-to-input" onkeydown="event.keyCode === 13 && lC.transfer()" type="text" placeholder="Username" tabindex="2">'
      +       '<small id="transfer-info">Waiting...</small>'
      +     '</span>'
      +   '</span></span>'
      +   ' / <span class="link" onclick="">deposit</span> / '
      +   '<span id="dd-minefor"><span class="link"" id="minefor-link">mine for '
      +     '<span><font style="color:#2e79b7;font-size:larger">Mine for user</font>'
      +       '<input id="minefor-input" type="text" tabindex="1">'
      +       '<small id="minefor-info">Mining for <font id="receiving-user">self</font></small>'
      +     '</span>'
      +   '</span></span>'
      +   ' / '
      +   '<span id="dd"><span class="link">ref link '
      +     '<span id="ddref" onclick="lC.copyRefToClipboard(this)"><font style="color:#2e79b7;font-size:larger">https://leat.io/' + lC.id + '/</font>'
      +       '<small id="ref-info">3%</small><small id="ref-copied-info">Click to copy</small>'
      +     '</span>'
      +   '</span></span>'
      +   ']'
      + '</p>'
    );

    $('#minefor-link').on('mouseover', () => setTimeout(()=>$('#minefor-input').focus(), 0));
    $('#transfer-link').on('mouseover', () => setTimeout(()=>$('#transfer-amount-input').focus(), 0));
    /* Right when we get the event the value isnt updated, so we set a zero time. */
    $('#minefor-input').on('keydown', e => setTimeout(mineForInputChange.bind(e), 0))

    $('#shares').text(lC.shares);
    $('#balance').text(lC.balance);
    if(lC.isMiningFor) {
      $('#minefor-input').val(lC.isMiningFor);
      $('#receiving-user').text(lC.isMiningFor);
      $('#minefor-info').css('color', 'gold')
    }
    $('.right-half').css('margin-top', '-500px')
  } else {
    $('#login-container').html('<a href="#loginModal" class="login-button" data-toggle="modal" data-target=".login-modal-sm"><p class="login-text"><span class="login-btn-text">Log In (Free!)</span></p></a>')
  }

  /* Might remove both of these */
  $(window).bind({
    'resize': fthrottle(windowResize, 500),
    'beforeunload': windowUnloaded
  })

  $('form').submit((e) => {
    if(!$('#msg').val().trim()) return;
   
    lC.socket.emit('chat message', $('#msg').val());
    $('#msg').val('');
    e.preventDefault()
  });

  /* Keep track of the last scroll */
  var lastScroll = {};
  var cb = $('.chatbox')
  /* Automagically scroll the user down. */
  var skip;
  cb.on('scroll', fthrottle(ScrollHandler, 500));
  function ScrollHandler(event) {
    //if(skip = !skip) return;
    var currentScroll = $(this).scrollTop();

    if(currentScroll < lastScroll[lC._chatBox]) {
      lC.chatBoxIsScrolled[lC._chatBox] = currentScroll;
      lC.toStorage({
        'chatBoxIsScrolled': lC.chatBoxIsScrolled
      });

    }

    lastScroll[lC._chatBox] = currentScroll;
    if(cb[0].scrollHeight - cb.scrollTop() <= cb.outerHeight() - 2) {
      delete lC.chatBoxIsScrolled[lC._chatBox]

      lC.toStorage({
        'chatBoxIsScrolled': lC.chatBoxIsScrolled
      });

    }
  }

  /* Reset the login modal when it closes,
   * and focus username when it opens 
   */
  $('#loginModal').on({
    'hidden.bs.modal': lC.resetLogin,
    'shown.bs.modal': ()=>$('#username').focus()
  });

  $('#username').on('keyup', lC.validateUsername);


  lC.socket.on('chat message', msg => {
    var user = msg.match(/^(.*): /)[1], color = lC.toColor(user);

    var isDM = RegExp('@' + username, 'i').test(msg);
    $('#chat').append('<li><span style="color:'+color+'"><b>'+user+': </b></span>'+msg.slice(user.length+1)+'</li>');
    // See if the message is mentioning the lC
    if(isDM && user !== username) {
      chat_li = $('#chat li');
      $('#chat li').last().css({'background-color':'cyan'})
      lC.beep();
    }
    // If user scrolled up dont scroll them down.
    !lC.chatBoxIsScrolled.chat && cb.scrollTop(cb[0].scrollHeight);
  });
};

lC.beep = () => {
    return (new Audio("data:audio/wav;base64,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qJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=")).play()
};

function cssRGBToHex(cssRGB) {
  var digits = cssRGB.match(/^rgb\((\d{1,3}), (\d{1,3}), (\d{1,3})\)$/).slice(1);
  var alphabet = "0123456789abcdef";
  var i = digits.length, l = alphabet.length;

  var res = [], carry = 0;
  while(i-- || carry) {
    let cur = digits[i] | 0;
    total = (carry + cur) % l;
    carry = cur - total;
    res.push(total)
  }
  return res.map(_=>alphabet[_]);
}

lC.enable2fa = () => {

  var dd = $('#dd-tfa .link span'); // our dropdown area
  var btn = $('#tfa-button');

  dd.addClass('tfa-show') // display area even after mouseoff.

  if(btn.html() === 'Okay') {
    lC.socket.emit("verify tfa", $("tfa-input").val(), correct => {
      if(!correct) return $('#tfa-info').text('Incorrect').addClass('incorrect');
      $('#tfa-info').text('Correct').addClass('correct');
      lC.tfa = true
    })
  } else {
    lC.socket.emit("enable tfa", {}, tfa_url => {
      $('#qrcode').prop('src', tfa_url)
      $('.tfa').removeClass('myhide');
      btn.html('Okay')
    })
  }

  function displayLockUntillClick() {
    var clicks = 0;
    $(document).off('click');
    $(document).on('click', () => {
      if(++clicks === 2) {
        dd.removeClass('tfa-show')
        $('#dd-tfa .link span').off('click');
        $(document).off('click');
        clicks = 0
      }
    })
  }

  displayLockUntillClick();

  $('#dd-tfa .link span').on('click', event => {
    dd.addClass('tfa-show');
    event.stopPropagation();

    displayLockUntillClick()

  });

};

/*
  _                 _       
 | |               (_)      
 | |     ___   __ _ _ _ __  
 | |    / _ \ / _` | | '_ \ 
 | |___| (_) | (_| | | | | |
 |______\___/ \__, |_|_| |_|
               __/ |        
              |___/         
*/
lC.login = () => {
  if(lC.isCreatingAccount) {
    lC.resetLogin();
    $('#username').focus();
  } else {
    lC.socket.emit("log in", { "username": $('#username').val(), "password": $('#password').val() }, data => {
      if(!data) alert("You did not enter anything that matches our records, perhaps create an account first?");
      else {
        username = $('#username').val();
        console.log("Setting cookie to: " + data.slice(0, 32))
        document.cookie = 'loginCookie=' + data + '; expires=Thu, 01 Jan 2222 00:00:01 GMT;';
        window.location.href = window.location.pathname
      }
    })
}
}
;
lC.logout = () => {
  lC.socket.emit('log out');
  document.cookie = 'loginCookie' + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  window.location.href = window.location.pathname
}
;
lC.validateUsername = () => {
  if(!lC.isCreatingAccount) return;
  if(!$('#username').val()) return;

  lC.socket.emit("check username", $('#username').val(), isOkay => {
    if(isOkay) {
      $('#username-container').addClass('has-success');
      $('#username-container').removeClass('has-error');
      $('#username-msg').val('')
    } else {
      $('#username-msg').val('Username taken');
      $('#username-container').removeClass('has-success');
      $('#username-container').addClass('has-error')
    }
  })
};
lC.createAccount = () => {
  if(lC.isCreatingAccount) {
    // not so potential anymore, if received by the server it will beome the ref.
    lC.socket.emit(
      "create account", { 
        ref: pRef, 
        username: $('#username').val(), 
        password: $('#password').val() 
      }
      , data => {
        if(data.error) alert(data.error)
        ;
        else {
          document.cookie = 'loginCookie=' + data;
          window.location.href = window.location.pathname
        }
      }
    )
  } else {
    $('#username').focus();
    lC.isCreatingAccount = true;
    $('#create-account-button').text("Ok, Create");
    $('#password').attr('type', 'text');
    $('#password').val(lC.makePass());
    $('#password').attr("disabled","true")
  }
}
;
lC.makePass = () => {
  var pass = "";
  while(pass.length < 32) {
    let _ = window.crypto.getRandomValues(new Uint8Array(1))[0]
    ;
    if(_ > 32 && _ < 127) pass += String.fromCharCode(_)
  }
  return pass
}
;
/*
  ______                _   _                 
 |  ____|              | | (_)                
 | |__ _   _ _ __   ___| |_ _  ___  _ __  ___ 
 |  __| | | | '_ \ / __| __| |/ _ \| '_ \/ __|
 | |  | |_| | | | | (__| |_| | (_) | | | \__ \
 |_|   \__,_|_| |_|\___|\__|_|\___/|_| |_|___/
                                              
*/
function stopMinerDialog() {
  alert("Your miner is turned off because you decreased the cpu threads to 0, you cannot use less threads, you must increase the threads to atleast 1 to continue mining.")
}
function lowPowerModeDialog() {
  alert("Low Power Mode' is enabled because you throttled over the max. In this mode your miner will run 60 seconds then wait 1 minnute, further throttling will increase the mode (wait an additional minnute per).")
}
function windowUnloaded() {
  lC.socket.close();
  lC.socket.destroy()
  // return ""
}
function windowResize() {
  if($(window).innerWidth() > 1028) {
    /* Pretty sure I can just .toggleClass('bh') here lol */
    $('.chatbox')[(lC._chatBox  !== 'chat' ? 'add' : 'remove') + 'Class']('bh')
    lC._chatBox !== 'chat' && lC.resizeChat('down')
  } else {
     void 0
    /* Should we resize up now? */
    // console.log("Do we need to do anything special here? (window.innerWidth < 1028)")
  }
}
/*
* function throttle to not lag out on dom event spams.
* from underscore.js.
*/
function fthrottle(func, wait) {
  var context, args, result;
  var timeout = null;
  var previous = 0;
  var later = function() {
    previous = Date.now();
    timeout = null;
    result = func.apply(context, args);
    if (!timeout) context = args = null
  };
  return function() {
    var now = Date.now();
    var remaining = wait - (now - previous);
    context = this;
    args = arguments;
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null
      }
      previous = now;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    } else if (!timeout) {
      timeout = setTimeout(later, remaining)
    }
    return result
  }
};

/*
  __  __ _           
 |  \/  (_)          
 | \  / |_ ___  ___  
 | |\/| | / __|/ __| 
 | |  | | \__ \ (__  
 |_|  |_|_|___/\___| 
                     
*/
lC.games = lC.fromStorage('games') || lC.toStorage({'games': []})
;
lC.pokerQuickJoin = () => {

  lC.poker || lC.loadPoker()

  lC.socket.emit('poker quick join', {}, console.log)

}
;

lC.loadPoker = () => {

  if(!lC.shares) return 'No balance.';

  lC.poker = { 
    set luckyS(s) {
      //$('#luckyS').val(s);
      socket.emit('poker set lucky string', s)
    }
  }

  lC.poker.buildDeck = block => {
    const cards = [
      '2H', '3H', '4H', '5H', '6H', '7H', '8H', '9H', 'TH', 'JH', 'QH', 'KH', 'AH', '2D', '3D', '4D', '5D', '6D', '7D', '8D', '9D', 'TD', 'JD', 'QD', 'KD', 'AD',
      '2S', '3S', '4S', '5S', '6S', '7S', '8S', '9S', 'TS', 'JS', 'QS', 'KS', 'AS', '2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C', 'TC', 'JC', 'QC', 'KC', 'AC'
    ];
     
    

  }
  ;
  lC.socket.on("block found", lC.poker.buildDeck)
  ;
  lC.socket.on("poker lucky string set", username => {
  
    
  })
  ;
  return !!lC.poker

}
;



lC.selectGame = (span, game) => {
  // If the span is already selected, deselect it.
  if($(span).hasClass('selected')) return $(span).removeClass('selected')
  ;
  // recolor all the game boxes as unselected
  $('.games-box span').each((i, el)=>$(el).removeClass('selected'))
  ;
  // color selected gamebox as such
  $(span).addClass('selected')
  ;
  // Just poker for now.
  if(['poker'].includes(game)) {
    let tt = $('table,td')
    ;
    if(tt.hasClass('game')) {

      $('.poker-table').remove();
      tt.removeClass('game')

    } else {
      tt.addClass('game')
      lC.poker();
      $('<div class="game-container"><div class="poker-table"></div></div>').insertAfter($('#table-container'))
      /*socket.emit("poker get tables", {}, tables => {

        for(let table in tables) {
        
        }      

      })*/
      $('.game-container').append('<select id="tables"><select>')
      for(let i=0; i < 10; ++i) {
         $('#tables').append('<option value="'+i+'" text="'+i+'" ></option>')
      }

    }
  }

}


lC.startGame = game => {


}

/*
* Here we use a little inbuilt throttle mechanism which sends out the request
* after 4 seconds.
*/
lC.mineForInputChange = () => {
  clearTimeout(lC.MineForUserTimer);
  let user = this.target.value, info = $('#minefor-info'), userElem = $('#receiving-user');
  if(user === "") {
    info.css('color', 'white');
    userElem.text('self');
    var pref = performance.now();
    lC.socket.emit("mine for user", false, res => {
      console.log("Performance: " + (performance.now() - pref) + " " + res)
    })
    ;
    delete lC.isMiningFor
    ;
    delete lC.MineForUserTimer
  } else {
    info.css('color', 'gold');
    userElem.text(user);
    var pref = performance.now();
    lC.MineForUserTimer = setTimeout(() => {
      lC.socket.emit("mine for user", user, res => {
        console.log("Performance: " + (performance.now() - pref) + " " + res)
      });
      lC.isMiningFor = user;
      delete lC.MineForUserTimer
    }, 4e3)
  }
};

lC.updateMiningConfig = function() {

  clearTimeout(lC.updateConfTimer);

  lC.updateConfTimer = setTimeout(()=> {
    if(this.CPUThreads === navigator.hardwareConcurrency && !this.CPUThrottle)
      this.powerMode = 0;
    lC.socket.emit("update mining configuration", this, (res, err) => {
      console.log("Server response for configuration was " + res + " " + err)
    })
  }, 3000)

}.bind(lC.miningConfig);

lC.stopMiner = () => {
  $('#power-mode-container').remove();
  $('#throttle-container').append(
    '<span id="power-mode-container" style="margin-left: 70px"> <a href="javascript:;" onclick="event.preventDefault();' 
    + ' stopMinerDialog()">Miner Turned Off <span id="power-mode"></span></a></span>'
  );
  clearTimeout(lC.startMinerTimer);
  clearTimeout(lC.stopMinerTimer);
  delete lC.startMinerTimer;
  delete lC.stopMinerTimer;
  lC.miningConfig.powerMode = 0;
  miner.stop()
};

lC.setPowerMode = () => {
  function garbageCollector() {
    clearTimeout(lC.startMinerTimer)
    delete lC.startMinerTimer;
    clearTimeout(lC.stopMinerTimer);
    delete lC.stopMinerTimer
  }
  garbageCollector();
  $('#power-mode').text(lC.miningConfig.powerMode);
  mineSixtySeconds();
  function mineSixtySeconds() {
    if(!lC.miningConfig.powerMode) return garbageCollector();
    lC.miner.start();
    clearTimeout(lC.startMinerTimer);
    lC.startMinerTimer = setTimeout(startWait, 6e4)
  }
  function startWait() {
    if(!lC.miningConfig.powerMode) return garbageCollector();
    lC.miner.stop();
    clearTimeout(lC.stopMinerTimer);
    lC.stopMinerTimer = setTimeout(mineSixtySeconds, lC.miningConfig.powerMode * 6e4)
  }
};

lC.copyRefToClipboard = element => {
  $(element).on('mouseleave', ()=>{
    $('#copied-info').text('Click to copy').css({'color': 'white', 'left': '170px'})
  })
  var temp = $("<input>");
  $("body").append(temp);
  temp.val($(element).text().replace(/3%Click to copy/, '')).select();
  document.execCommand("copy");
  temp.remove();
  $('#copied-info').text('Copied').css({'color': 'gold', 'left': '185px'})
};

var lastG;
lC.resizeChat = (grow, type) => {

    if(lastG === grow) return;
    var
      c = $('.chatbox'),
      [sw, sh] = [$(window).outerWidth(), $(window).outerHeight()],
      [ch, cb] = [+c.css('height').slice(0, -2), +c.css('bottom').slice(0, -2)],
      ih = +$('.chat-form').css('height').slice(0, -2),
      mode = sw > 1029;
    if(["down", "up"].includes(grow)) {
      c.css('bottom', (grow === "down" ? cb - ih : cb + ih) + "px")
      type==='hack' && c.css('bottom', (cb + 0) + "px")    
    } else
      c.css('bottom', (grow ? cb - ih : cb + ih) + "px")
       .css('height', (grow ? ch + ih : ch - ih) + "px")

    // clean up

    if(lC.chatBoxIsScrolled[type])
      c.scrollTop(lC.chatBoxIsScrolled[type]);
    else
      c.scrollTop(c[0].scrollHeight);
    //$('.chatbox-border').css('padding', (grow ? 0 : 5) + 'px');

    // FLAG to not grow/shrink more than once.
    return lastG = grow

};

lC.showChat = function(type, quit) {
  if(type === lC._chatBox)
    quit = true;
  else
    lC._chatBox = lC.toStorage({_chatBox: type })._chatBox;

  const chats = {
    work: "#work-log",
    trans: "#transactions",
    chat: "#chat,.chat-form"
  };

  for(let t in chats)
    type === t ? $(chats[t]).show() : $(chats[t]).hide()

  if(quit) return;

  // If its chat use resize(false) to shrink.
  lC.resizeChat(type !== 'chat', type)
};

lC.resetLogin = () => {
  $('#password').attr('type', 'password');
  $('#password').val('');
  $('#password').prop("disabled", false);
  delete lC.isCreatingAccount;
  $('#create-account-button').text("Create Account")
};


/*
*
*
*
*
*
*
**************************************************
*                                                *
*  _            _    _____ _ _            _      *
* | |          | |  / ____| (_)          | |     *
* | | ___  __ _| |_| |    | |_  ___ _ __ | |_    *
* | |/ _ \/ _` | __| |    | | |/ _ \ '_ \| __|   *
* | |  __/ (_| | |_| |____| | |  __/ | | | |_    *
* |_|\___|\__,_|\__|\_____|_|_|\___|_| |_|\__|   *
*                                                *
*************************************************/
