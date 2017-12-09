var Poker = {
    rankToString: ['', '', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'],

    rankToWord: ['', '', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king', 'ace'],

    suitToString: ['H', 'D', 'C', 'S'],

    rankToInt: {'2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14},

    suitToInt: {'H': 0, 'D': 1, 'C': 2, 'S': 3},

    HAND_TYPE: { 'HIGH_CARD': 1, 'PAIR': 2, 'TWO_PAIR': 3, 'TRIPS': 4,  'STRAIGHT': 5,
                 'FLUSH': 6, 'FULL_HOUSE': 7, 'QUADS': 8, 'STRAIGHT_FLUSH': 9 },

    // base52: "123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq".split(''),

    base52ToCard: {
      '1': '2H', '2': '3H', '3': '4H', '4': '5H', '5': '6H', '6': '7H', '7': '8H',
      '8': '9H', '9': 'TH', 'A': 'JH', 'B': 'QH', 'C': 'KH', 'D': 'AH', 'E': '2D',
      'F': '3D', 'G': '4D', 'H': '5D', 'I': '6D', 'J': '7D', 'K': '8D', 'L': '9D',
      'M': 'TD', 'N': 'JD', 'O': 'QD', 'P': 'KD', 'Q': 'AD',
      'R': '2S', 'S': '3S', 'T': '4S', 'U': '5S', 'V': '6S', 'W': '7S', 'X': '8S',
      'Y': '9S', 'Z': 'TS', 'a': 'JS', 'b': 'QS', 'c': 'KS', 'd': 'AS', 'e': '2C',
      'f': '3C', 'g': '4C', 'h': '5C', 'i': '6C', 'j': '7C', 'k': '8C', 'l': '9C',
      'm': 'TC', 'n': 'JC', 'o': 'QC', 'p': 'KC', 'q': 'AC'
    },
    cards: [
      '2H', '3H', '4H', '5H', '6H', '7H', '8H', '9H', 'TH', 'JH', 'QH', 'KH', 'AH', '2D', '3D', '4D', '5D', '6D', '7D', '8D', '9D', 'TD', 'JD', 'QD', 'KD', 'AD',
      '2S', '3S', '4S', '5S', '6S', '7S', '8S', '9S', 'TS', 'JS', 'QS', 'KS', 'AS', '2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C', 'TC', 'JC', 'QC', 'KC', 'AC'
    ]
};

// an immutable Card object with a rank and a suit
Poker.Card = function(rank, suit, base52) {
    this._rank = rank;
    this._suit = suit;
};

Poker.Card.prototype.getRank = function() {
    return this._rank;
};

Poker.Card.prototype.getSuit = function() {
    return this._suit;
};

Poker.Card.prototype.toBase52 = function() {
    return Poker.BASE_52[ Poker.cards.indexOf(Poker.rankToString[this._rank] + '' + Poker.suitToString[this._suit].toUpperCase()) ];
};

Poker.Card.prototype.toString = function() {
    return Poker.rankToString[this._rank] + '' + Poker.suitToString[this._suit];
};

// create Card object from string like 'As', 'Th' or '2c'
Poker.cardFromString = function(cardVal) {
    return new Poker.Card(
        Poker.rankToInt[cardVal[0]],
        Poker.suitToInt[cardVal[1]]
    );
};

// a poker Hand object consists of a set of Cards, and poker related functions
Poker.Hand = function(cards) {
    this.cards = cards;
};

Poker.Hand.prototype.numSameSuits = function() {
    var counters = [0, 0, 0, 0];
    for (var idx = 0; idx < this.cards.length; idx += 1) {
        counters[this.cards[idx].getSuit()] += 1;
    };
    return Math.max.apply(null, counters);
};

// number of longest consecutive card rank run
Poker.Hand.prototype.numConnected = function() {
    var oRanks = this.getOrderedRanks(),
        run = max = 1,
        thisCardRank, prevCardRank;

    for (var idx = 1; idx < oRanks.length; idx += 1) {
        thisCardRank = oRanks[idx];
        prevCardRank = oRanks[idx - 1];
        if (thisCardRank !== prevCardRank + 1) {
            run = 1;
        }
        else {
            run = run + 1;
            max = run > max ? run : max;
        }
    }
    if (this.isLowStraight(oRanks)) {
        return 5;
    }
    return max;
};

// special case where A plays low for A to 5 straight
Poker.Hand.prototype.isLowStraight = function(oRanks) {
    var lowFourCards = oRanks.slice(0, 4);
    // if 2,3,4,5 and Ace in hand
    if (this.equivIntArrays(lowFourCards, [2,3,4,5]) && oRanks.indexOf(14) > -1) {
        return true;
    }
    return false;
}

// true if two int arrays identical
Poker.Hand.prototype.equivIntArrays = function(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (var idx = 0; idx < a.length; idx += 1) {
        if (a[idx] !== b[idx]) {
            return false;
        }
    }
    return true;
}

// return ranks ordered lowest to highest: 2..14 (ace plays high)
Poker.Hand.prototype.getOrderedRanks = function(desc) {
    var ranks = [];
    for (var idx = 0; idx < this.cards.length; idx += 1) {
        ranks.push(parseInt(this.cards[idx].getRank(), 10));
    };
    return ranks.sort(this.numeric);
};

// return count of same ranked cards, e.g. [3,2] for fullhouse
Poker.Hand.prototype.numOfAKind = function() {
    var rankCount = this.getRankCount(),
        values = this.objToArray(rankCount),
        numKind = values.sort(this.numeric).reverse();
    return numKind;
};

// map each rank to number of times it occurs in hand
Poker.Hand.prototype.getRankCount = function() {
    var oRanks = this.getOrderedRanks(),
        rankCount = {};
    for (var idx = 0; idx < oRanks.length; idx += 1) {
        if (rankCount[oRanks[idx]]) {
            rankCount[oRanks[idx]] += 1;
        }
        else {
            rankCount[oRanks[idx]] = 1;
        }
    }
    return rankCount;
};

// return obj values as array
Poker.Hand.prototype.objToArray = function(obj) {
    var values = [];
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            values.push(obj[key]);
        }
    }
    return values;
}

// 99887: getRankByOccurance(2) => [9,8]
Poker.Hand.prototype.getRankByOccurance = function(n) {
    var rankCount = this.getRankCount(),
        matchedRanks = [];

    for (var rank in rankCount) {
        if (rankCount.hasOwnProperty(rank)) {
            if (rankCount[rank] === n) {
                matchedRanks.push(parseInt(rank, 10));
            }
        }
    }
    // if low straight, special case
    if (n === 1 && this.isLowStraight(this.getOrderedRanks())) {
        return [5,4,3,2,1];
    }

    return matchedRanks.sort(this.numeric).reverse();
};

// return object {value: array, name: string}, where array looks like
// [hand_type, primary, secondary, ...] and allows comparing
// of hand values (highest element in left to right comparison wins).
// name string is a human readable description of the hand
Poker.Hand.prototype.getHandDetails = function () {
    var handDetails = {},
        word = Poker.rankToWord,
        hand = Poker.HAND_TYPE,
        primary, secondary;

    if (this.numSameSuits() === 5 && this.numConnected() === 5) {
        primary = this.getRankByOccurance(1)[0];
        handDetails.name = 'Straight flush, ' + word[primary] + ' high';
        handDetails.value = this.buildValueArray(hand.STRAIGHT_FLUSH, [1]);
        return handDetails;
    }
    if (this.numOfAKind()[0] === 4) {
        primary = this.getRankByOccurance(4)[0];
        handDetails.name = 'Four ' + word[primary] + 's';
        handDetails.value = this.buildValueArray(hand.QUADS, [4, 1]);
        return handDetails;
    }
    if (this.equivIntArrays(this.numOfAKind(), [3,2])) {
        primary = this.getRankByOccurance(3)[0];
        secondary = this.getRankByOccurance(2)[0];
        handDetails.name = 'Fullhouse, ' + word[primary] +
            's over ' + word[secondary] + 's';
        handDetails.value = this.buildValueArray(hand.FULL_HOUSE, [3, 2]);
        return handDetails;
    }
    if (this.numSameSuits() === 5 && this.numConnected() < 5) {
        primary = this.getRankByOccurance(1)[0];
        handDetails.name = 'Flush, ' + word[primary] + ' high';
        handDetails.value = this.buildValueArray(hand.FLUSH, [1]);
        return handDetails;
    }
    if (this.numConnected() === 5 && this.numSameSuits() < 5) {
        primary = this.getRankByOccurance(1)[0];
        handDetails.name = 'Straight, ' + word[primary] + ' high';
        handDetails.value = this.buildValueArray(hand.STRAIGHT, [1]);
        return handDetails;
    }
    if (this.equivIntArrays(this.numOfAKind(), [3,1,1])) {
        primary = this.getRankByOccurance(3)[0];
        handDetails.name = 'Three ' + word[primary] + 's';
        handDetails.value = this.buildValueArray(hand.TRIPS, [3, 1]);
        return handDetails;
    }
    if (this.equivIntArrays(this.numOfAKind(), [2,2,1])) {
        primary = this.getRankByOccurance(2)[0];
        secondary = this.getRankByOccurance(2)[1];
        handDetails.name = 'Two pair, ' +  word[primary] + 's over ' +
            word[secondary] + 's';
        handDetails.value = this.buildValueArray(hand.TWO_PAIR, [2, 1]);
        return handDetails;
    }
    if (this.equivIntArrays(this.numOfAKind(), [2,1,1,1])) {
        primary = this.getRankByOccurance(2)[0];
        handDetails.name = 'Pair of ' + word[primary] + 's';
        handDetails.value = this.buildValueArray(hand.PAIR, [2, 1]);
        return handDetails;
    }
    primary = this.getRankByOccurance(1)[0];
    handDetails.name = 'High card ' + word[primary];
    handDetails.value = this.buildValueArray(hand.HIGH_CARD, [1]);
    return handDetails;

};

Poker.Hand.prototype.buildValueArray = function(handType, rankOccurances) {
    var value = [handType];
    for (var idx = 0; idx < rankOccurances.length; idx += 1) {
        value = value.concat(this.getRankByOccurance(rankOccurances[idx]));
    }
    return value;
};

Poker.Hand.prototype.toString = function() {
    var str = '';
    for (var idx = 0; idx < this.cards.length; idx += 1) {
        str += this.cards[idx].toString() + ' ';
    };
    return str.slice(0, str.length - 1);
}

Poker.Hand.prototype.numeric = function(a, b) {
    return a - b;
}

// create Hand object from string like 'As Ks Th 7c 4s'
Poker.handFromString = function(handString) {
    var cardStrings = handString.split(' '),
        cards = [];
    for (var idx = 0; idx < cardStrings.length; idx += 1) {
        cards.push(Poker.cardFromString(cardStrings[idx]));
    };
    return new Poker.Hand(cards);
};

// a deck of Card objects
Poker.Deck = function() {
    var cards = [],
        dealt = [];

    createCards();

    function createCards() {
        for (var suitIdx = 0; suitIdx < 4; suitIdx += 1) {
            for (var rankIdx = 2; rankIdx < 15; rankIdx += 1) {
                cards.push(new Poker.Card(rankIdx, suitIdx));
            }
        }
    }

    this.size = function() {
        return cards.length;
    };

    // return numCards from deck (or less if deck exhausted)
    this.deal = function(numCards) {
        var cardArray = [],
            len = Math.min(numCards, cards.length);
        for (var idx = 0; idx < len; idx += 1) {
            card = cards.pop();
            cardArray.push(card);
            dealt.push(card);
        }
        return cardArray;
    };

    // shuffle the deck (implicitly returns deck to full size)
    this.shuffle = function(block, secrets) {
        if(!block) throw 'Need block to shuffle.'
        if(!secrets) throw 'Need secrets to shuffle.'

        if(block.length !== 77) 
          throw 'Invalid block.'

        if(secrets.length % 2)
          throw 'Invalid secrets.'

        returnDealtCards();

        shuffle(cards, block, secrets);
    };

    function returnDealtCards() {
        var len = dealt.length;
        while (len--) {
            cards.push(dealt.pop());
        }
    }

    // Fisher-Yates shuffle code found at:
    // http://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array-in-javascript
    // swap each element in cards with a random other element
    function shuffle(cards, block, secrets) {
        return null;
    }

    this.toString = function() {

        
        return cards.toString();
    };
};

// compare an array of Hands and return the winner(s) in an array
Poker.getWinners = function(hands) {
    var numberValues = getNumberValues(hands),
        winningHandValue = Math.max.apply(Math, numberValues),
        winnerIndices = getIndicesOfMatching(numberValues, winningHandValue);

    return getWinningHands(winnerIndices);

    // map the hands onto an array of comparable number values
    function getNumberValues(hands) {
        var numberValues = [],
            valueArray;
        for (var idx = 0; idx < hands.length; idx += 1) {
            valueArray = hands[idx].getHandDetails().value;
            numberValues.push(handValueToNumber(valueArray));
        };
        return numberValues;
    }

    // convert a hand value from an array to a fixed number
    // eg: [12,3,4] => 1203040000
    function handValueToNumber(valueArray) {
        var strArray = [],
            paddedValueArray = valueArray.concat([0,0,0,0,0]).slice(0,6);
        for(let idx = 0; idx < paddedValueArray.length; ++idx) {
            strArray.push(('0' + paddedValueArray[idx]).slice(-2));
        }
        return parseInt(strArray.join(''), 10);
    }


    // return all indices of array whose value === val (empty array if none)
    function getIndicesOfMatching(array, val) {
        var idx = array.length,
            indices = [];
        while (idx--) {
            if (array[idx] === val) {
                indices.push(idx);
            }
        }
        return indices;
    }

    function getWinningHands(winnerIndices) {
        var winningHands = [];
        for(let idx = 0; idx < winnerIndices.length; ++idx) {
            winningHands.push(hands[winnerIndices[idx]]);
        }
        return winningHands;
    }

};

// if in Node.js environment export the Poker namespace
if (typeof exports !== 'undefined') {
    exports.Poker = Poker;
}
