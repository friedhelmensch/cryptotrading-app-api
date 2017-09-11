import { executeForAll } from './libs/iteration-lib';

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

    executeForAll(doTheTrading, callback);
};

async function doTheTrading(kraken, pair, euroToInvest) {

    const factor = 1.6;
    const signal = 5;
    const euroLimit = 0;

    var balanceResult = await kraken.api('Balance');

    var hasEnoughMoney = checkSufficientBalance(balanceResult, euroLimit);
    if (!hasEnoughMoney) {
        console.log("not enough money");
        return;
    }

    var now = Date.now();
    var fourHourAgo = 4 * 60 * 60 * 1000;
    var startTime = (now - fourHourAgo) / 1000;
    var ohlcResponse = await kraken.api('OHLC', { pair: pair, interval: 240, since: startTime });

    if (ohlcResponse.result[pair].length > 1) {
        console.error(ohlcResponse.result[pair].length + " candles for : " + pair);
        return;
    }
    
    var candle = getCandle(ohlcResponse, pair);
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

function getCandle(response, pair)
{
    var result = response.result[pair][0];
    var high = result[2] * 1;
    var low = result[3] * 1;
    var close = result[4] * 1;
    // * 1 to convert string to number
    return {high: high, low : low, close: close, pair : pair }
}

function shouldPlaceOrder(candle, signal, factor)
{
    const low_gap = Math.abs(((candle.close / candle.low) - 1) * 100);
    const high_gap = Math.abs(((candle.close / candle.high) - 1) * 100);
    const spread = low_gap + high_gap;
    const factored_high_gap = high_gap * factor;

    if (spread > signal) {
        if (factored_high_gap > spread) {
            return true;
        }
    }
    console.log("Order NOT placed for: " + candle.pair + " spread: " + spread.toFixed(2) + " signal: " + signal + " factored_high_gap: " + factored_high_gap.toFixed(2) + " high " + candle.high.toFixed(2) + " low " + candle.low.toFixed(2) + " close " + candle.close.toFixed(2) + " low_gap " + low_gap.toFixed(2) + " high_gap " + high_gap.toFixed(2));
    return false;
}

function createOrder(ask, bid, euro, pair, decimals) {

    //kraken has different decimal precision per pair, so we need to truncate the price accordingly
    var price = (((ask + bid) / 2).toFixed(decimals));
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