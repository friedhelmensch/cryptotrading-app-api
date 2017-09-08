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

    try {
        const params = { TableName: 'profiles' };
        const profilesResult = await dynamoDbLib.call('scan', params);
        var profiles = profilesResult.Items;

        for (var i = 0, len = profiles.length; i < len; i++) {

            var profile = profiles[i];

            var settingsParams = {
                TableName: "settings",
                KeyConditionExpression: "userId = :userId",
                ExpressionAttributeValues: { ":userId": profile.userId }
            };

            var kraken = new KrakenClient(profile.apiKey, profile.apiSecret);
            const settingsResult = await dynamoDbLib.call('query', settingsParams);

            var settings = settingsResult.Items;

            for (var i = 0, len = settings.length; i < len; i++) {
                var setting = settings[i];

                try {
                    var euroToInvest = setting.amount;
                    var pair = setting.currency;
                    await doTheTrading(kraken, pair, euroToInvest);

                } catch (e) {
                    console.error("trading went wrong for: " + setting.currency + " " + e);
                }
            }
        }
        callback(null, success(true));
    }
    catch (e) {
        console.error("function failed: " + e);
        callback(null, failure({ status: false }));
    }
};

async function doTheTrading(kraken, pair, euroToInvest) {

    const factor = 1.6;
    const signal = 5;
    const euroLimit = 0;

    var now = Date.now();
    var fourHourAgo = 4 * 60 * 60 * 1000;
    var startTime = (now - fourHourAgo) / 1000;
    
    var balanceResult = await kraken.api('Balance');
    
    var hasEnoughMoney = checkSufficientBalance(balanceResult, euroLimit);
    if (!hasEnoughMoney) {
        console.log("not enough money");
        return;
    }
    
    var ohlcResult = await kraken.api('OHLC', { pair: pair, interval: 240, since: startTime });
    
    if(ohlcResult.result[pair].length > 1) {
        console.error(ohlcResult.result[pair].length + " candles for : " + pair);
        return;
    }
    
    var candle = ohlcResult.result[pair][0];
    var placeOrder = shouldPlaceOrder(candle, pair, signal, factor);

    if (placeOrder) {
        var tickerResult = await kraken.api('Ticker', { pair: pair });

        var ask = Number(tickerResult.result[pair]['a'][0]);
        var bid = Number(tickerResult.result[pair]['b'][0]);

        var assetPairs = await kraken.api('AssetPairs');
        var decimals = assetPairs.result[pair].pair_decimals;

        var order = createOrder(ask, bid, euroToInvest, pair, decimals);
        console.log("Placing order: " + pair + " for: " + euroToInvest + " EUR");
        await kraken.api('AddOrder', order);
        console.log("Order placed. buy: " + pair + " for: " + euroToInvest + " EUR");
    }
}

function checkSufficientBalance(result, euroLimit) {
    var euroInAccount = result.result['ZEUR'];
    return euroInAccount > euroLimit;
}

function shouldPlaceOrder(candle, pair, signal, factor) {
    //https://www.kraken.com/help/api

    var high = candle[2];
    var low = candle[3]
    var close = candle[4];

    var low_gap = ((close / low) - 1) * 100;
    var high_gap = ((close / high) - 1) * 100;
    var spread = Math.abs(low_gap) + Math.abs(high_gap);

    if (spread > signal) {
        var factored_High_Gap = Math.abs(high_gap) * factor;
        if (factored_High_Gap > spread) {
            return true;
        }
    }
    console.log("Order NOT placed for: " + pair +  " spread " + spread.toFixed(2) + " high " + high + " low " + low + " close " + close + " low_gap " + low_gap.toFixed(2) + " high_gap " + high_gap.toFixed(2));
    return false;
}

function createOrder(ask, bid, euro, pair, decimals) {
    //kraken has different decimal precision per pair, so we need to truncate the price accordingly
    var price = (((ask + bid) / 2).toFixed(decimals)) - 10 ;
    var expire = ((new Date().getTime() + (0.5 * 60 * 60 * 1000)) / 1000).toFixed(0); //half hour
    var volume = euro / price;

    var order = {
        trading_agreement: 'agree',
        pair: pair,
        type: 'buy',
        ordertype: 'limit',
        price: price,
        volume: volume,
        expiretm: expire,
        close: {
            ordertype: 'limit',
            price: '#3%'
        }
    };
    return order
}