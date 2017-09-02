import KrakenClient from './libs/kraken-lib';
import * as dynamoDbLib from './libs/dynamodb-lib';
import { success, failure } from './libs/response-lib';

var lastReqId;

export async function main(event, context, callback) {

    // We check if the lambda is being retried.
    // If that's the case, we kill it
    // We leverage lambda's quirks:
    // - lambda's node process reuse which keeps vars instanced
    // - retried lambdas have the same request id 
    // Hopefully Amazon will someday allow us to disable autoretries
    // https://forums.aws.amazon.com/thread.jspa?threadID=176074
    if (lastReqId == context.awsRequestId) {
        console.log('Lambda auto retry detected. Aborting.');
        callback(null, success(true));
        return context.succeed();
    } else {
        lastReqId = context.awsRequestId;
    };

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
    const euroLimit = 0;

    var now = Date.now();
    var hours = 12;
    var history = 1000 * 60 * 60 * hours;
    var startTime = now - history;

    var balanceResult = await kraken.api('Balance');
    console.log("balanceResult received. " + pair);
    var hasEnoughMoney = checkSufficientBalance(balanceResult, euroLimit);
    if (!hasEnoughMoney) {
        console.log("not enough money");
        return;
    }

    var ohlcResult = await kraken.api('OHLC', { pair: pair, interval: 60, since: startTime });
    console.log("ohlcResult received. " + pair);
    var placeOrder = shouldPlaceOrder(ohlcResult.result[pair], pair, signal, factor);

    if (placeOrder) {
        var tickerResult = await kraken.api('Ticker', { pair: pair });

        var ask = Number(tickerResult.result[pair]['a'][0]);
        var bid = Number(tickerResult.result[pair]['b'][0]);

        var assetPairs = await kraken.api('AssetPairs');
        console.log("assetPairs received. " + pair);
        var decimals = assetPairs.result[pair].pair_decimals;

        var order = createOrder(ask, bid, euroToInvest, pair, decimals);
        var addOrderResult = await kraken.api('AddOrder', order);
        console.log("Order placed. buy: " + pair + " for: " + euroToInvest + " EUR")

        return addOrderResult;
    }
    else{
        console.log("Conditions not met. Order NOT placed for: " + pair)
    }
}

function checkSufficientBalance(result, euroLimit) {
    var euroInAccount = result.result['ZEUR'];
    return euroInAccount > euroLimit;
}

function shouldPlaceOrder(ohlc, pair, signal, factor) {
    //https://www.kraken.com/help/api
    var latestData = ohlc[ohlc.length - 1];
    
    var high = latestData[2];
    var low = latestData[3]
    var close = latestData[4];

    var low_gap = ((close / low) - 1) * 100;
    var high_gap = ((close / high) - 1) * 100;
    var spread = Math.abs(low_gap) + Math.abs(high_gap);

    if (spread > signal) {
        var high = Math.abs(high_gap) * factor;
        if (high > spread) {
            return true;
        }
    }
    return false;
}

function createOrder(ask, bid, euro, pair, decimals) {
    //kraken has different decimal precision per pair, so we need to truncate the price accordingly
    var price = ((ask + bid) / 2).toFixed(decimals);
    var expire = new Date().getTime() + (30 * 60 * 1000); // 30 minutes
    var volume = euro / price;

    var order = {
        trading_agreement: 'agree',
        pair: pair,
        type: 'buy',
        ordertype: 'limit',
        price: price,
        volume: volume,
        expiretm: expire,
        oflags: 'fciq',
        close: {
            ordertype: 'limit',
            oflags: 'fcib',
            price: '#3%'
        }
    };
    return order
}