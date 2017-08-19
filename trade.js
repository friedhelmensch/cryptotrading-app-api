import KrakenClient from './libs/kraken-lib';
import * as dynamoDbLib from './libs/dynamodb-lib';
import { success, failure } from './libs/response-lib';

export async function main(event, context, callback) {

    const params = {
        TableName: 'settings'
    };

    try {
        const result = await dynamoDbLib.call('scan', params);
        var settings = result.Items;

        for (var i = 0, len = settings.length; i < len; i++) {
            var setting = settings[i];
            try {
                var apiKey = setting.apiKey;
                var apiSecret = setting.apiSecret;
                var euroToInvest = setting.amount;
                var pair = setting.currency;

                var kraken = new KrakenClient(apiKey, apiSecret);
                await doTheTrading(kraken, pair, euroToInvest);
            } catch (e) {
                console.error("trading went wrong: " + e);
            }
        }
        callback(null, success(true));
    }
    catch (e) {
        callback(null, failure({ status: false }));
    }
};

async function doTheTrading(kraken, pair, euroToInvest) {

    const factor = 1.7;
    const signal = 4;
    const euroLimit = 199;

    var now = Date.now();
    var hours = 12;
    var history = 1000 * 60 * 60 * hours;
    var startTime = now - history;

    var balanceResult = await kraken.api('Balance');
    var hasEnoughMoney = checkSufficientBalance(balanceResult, euroLimit);
    if (!hasEnoughMoney){
        console.log("not enough money");
        return;
    }

    var ohlcResult = await kraken.api('OHLC', { pair: pair, interval: 60, since: startTime });
    var placeOrder = shouldPlaceOrder(ohlcResult.result[pair], pair, signal, factor);

    if (placeOrder) {
        var tickerResult = await kraken.api('Ticker', { pair: pair });

        var ask = Number(tickerResult.result[pair]['a'][0]);
        var bid = Number(tickerResult.result[pair]['b'][0]);

        var order = createOrder(ask, bid, euroToInvest, pair);
        var addOrderResult = await kraken.api('AddOrder', order);
        console.log("order placed: " + order)
        return addOrderResult;
    }
}

function checkSufficientBalance(result, euroLimit) {
    var euroInAccount = result.result['ZEUR'];
    return euroInAccount > euroLimit;
}

function shouldPlaceOrder(ohlc, pair, signal, factor) {
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
            console.log("buy: " + pair + " high: " + high + " spread: " + spread);
            return true;
        }
        console.log("no buy spread larger than high: " + pair + " high: " + high + " spread: " + spread);
        return false;
    }
    else {
        console.log("no buy signal larger than spread: " + pair + " high: " + high + " spread: " + spread);
        return false;
    }
}

function createOrder(ask, bid, euro, pair) {
    var limit = (ask + bid) / 2;
    var expire = new Date().getTime() + (30 * 60 * 1000); // 30 minutes
    var volume = euro / limit;

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