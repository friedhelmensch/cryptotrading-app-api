import KrakenClient from 'kraken-api';

export async function main(event, context, callback) {

    const apiKey = 'xxx';
    const apiSecret = 'yyy';
    var kraken = new KrakenClient(apiKey, apiSecret);

    const factor = 1.7;
    const signal = 4;

    const euroToInvest = 100;
    const pair = 'XXBTZEUR';

    var now = Date.now();
    var hours = 12;
    var history = 1000 * 60 * 60 * hours;
    var startTime = now - history;

    var ohlcResult = await kraken.api('OHLC', { pair: pair, interval: 60, since: startTime });

    var shoulBuy = shouldBuy(ohlcResult.result[pair], pair, signal, factor);

    if (shouldBuy) {
        var tickerResult = await kraken.api('Ticker', { pair: pair});

        var ask = Number(tickerResult.result[pair]['a'][0]);
        var bid = Number(tickerResult.result[pair]['b'][0]);

        var order = createOrder(ask, bid, euroToInvest, pair);

        //var addOrderResult = await kraken.api('AddOrder', order);
    }
};


function shouldBuy(ohlc, pair, signal, factor) {
    var closes = ohlc[4];
    var lows = ohlc[3]
    var highs = ohlc[2];

    var close = closes[closes.length - 1];
    var low = lows[lows.length - 1];
    var high = highs[highs.length - 1];

    var low_gap = ((close / low) - 1) * 100;
    var high_gap = ((close / high) - 1) * 100;
    var spread = Math.abs(low_gap) + Math.abs(high_gap);

    if (spread > signal) {
        var high = Math.abs(high_gap) * factor;
        if (high > spread) {
            console.log(high);
            console.log(spread);
            console.log("buy");
            return true;
        }
        console.log(high);
        console.log(spread);
        console.log("no buy inner");
        return false;
    }
    else {
        console.log("no buy outer");
        return false;
    }
}

function createOrder(ask, bid, euro, pair) {
    var limit = (ask + bid) / 2;
    var expire = new Date().getTime() + (30 * 60 * 1000); // 30 minutes
    var volume = euro / limit;

    console.log(limit);

    var order = {
        trading_agreement: 'agree',
        pair: pair,
        type: 'buy',
        ordertype: 'limit',
        price: limit,
        volume: volume,
        expiretm: expire,
        oflags: 'fciq',
        close: {
            ordertype: 'take-profit-limit',
            oflags: 'fcib',
            price: '#3%',
            price2: '#0.1%'
        }
    };
    return order
}